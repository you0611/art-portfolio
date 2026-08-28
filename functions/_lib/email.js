export const EMAIL_OUTBOX_MAX_ATTEMPTS = 5;
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export const ADMIN_EMAIL_OUTBOX_SQL = `
  SELECT e.id, e.notification_event_id AS notificationEventId, e.order_id AS orderId,
    e.recipient_kind AS recipientKind, e.recipient_email AS recipientEmail,
    e.template, e.status, e.attempt_count AS attemptCount,
    e.provider_message_id AS providerMessageId, e.failure_message AS failureMessage,
    e.created_at AS createdAt, e.sent_at AS sentAt,
    o.public_reference AS reference, o.customer_name AS customerName,
    o.customer_email AS customerEmail, o.customer_contact AS customerContact,
    a.title_zh AS artworkTitleZh, a.title_en AS artworkTitleEn,
    ne.details_json AS eventDetailsJson
  FROM email_outbox e
  JOIN notification_events ne ON ne.id = e.notification_event_id
  JOIN orders o ON o.id = e.order_id
  JOIN order_items oi ON oi.order_id = o.id
  JOIN artworks a ON a.id = oi.artwork_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 100
`;

export const DISPATCHABLE_EMAIL_OUTBOX_SQL = `
  SELECT e.id, e.notification_event_id AS notificationEventId, e.order_id AS orderId,
    e.recipient_kind AS recipientKind, e.recipient_email AS recipientEmail,
    e.template, e.status, e.attempt_count AS attemptCount,
    e.provider_message_id AS providerMessageId, e.failure_message AS failureMessage,
    e.created_at AS createdAt, e.sent_at AS sentAt,
    o.public_reference AS reference, o.customer_name AS customerName,
    o.customer_email AS customerEmail, o.customer_contact AS customerContact,
    a.title_zh AS artworkTitleZh, a.title_en AS artworkTitleEn,
    ne.details_json AS eventDetailsJson
  FROM email_outbox e
  JOIN notification_events ne ON ne.id = e.notification_event_id
  JOIN orders o ON o.id = e.order_id
  JOIN order_items oi ON oi.order_id = o.id
  JOIN artworks a ON a.id = oi.artwork_id
  WHERE e.status IN ('pending', 'failed') AND e.attempt_count < ?
  ORDER BY e.created_at ASC, e.id ASC
  LIMIT 100
`;

function parseDetails(row) {
  try {
    const details = JSON.parse(row.eventDetailsJson || "{}");
    return details && typeof details === "object" ? details : {};
  } catch {
    return {};
  }
}

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function headerValue(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function encodeMimeHeader(value) {
  const clean = headerValue(value);
  if (/^[\x00-\x7f]*$/.test(clean)) return clean;
  const encoded = bytesToBase64(new TextEncoder().encode(clean));
  return `=?UTF-8?B?${encoded}?=`;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function base64UrlEncode(value) {
  return bytesToBase64(new TextEncoder().encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function gmailConfigError(message) {
  return new Error(`Gmail email provider is not configured: ${message}`);
}

export function createGmailEmailProvider(env, { fetchImpl = globalThis.fetch } = {}) {
  const fromEmail = String(env?.GMAIL_FROM_EMAIL || "").trim();
  const clientId = String(env?.GMAIL_CLIENT_ID || "").trim();
  const clientSecret = String(env?.GMAIL_CLIENT_SECRET || "").trim();
  const refreshToken = String(env?.GMAIL_REFRESH_TOKEN || "").trim();
  if (!validEmail(fromEmail)) throw gmailConfigError("GMAIL_FROM_EMAIL is missing or invalid.");
  if (!clientId) throw gmailConfigError("GMAIL_CLIENT_ID is missing.");
  if (!clientSecret) throw gmailConfigError("GMAIL_CLIENT_SECRET is missing.");
  if (!refreshToken) throw gmailConfigError("GMAIL_REFRESH_TOKEN is missing.");
  if (typeof fetchImpl !== "function") throw gmailConfigError("fetch is unavailable.");

  let accessTokenPromise = null;
  const getAccessToken = async () => {
    if (!accessTokenPromise) {
      accessTokenPromise = (async () => {
        const response = await fetchImpl("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        const body = await responseJson(response);
        if (!response.ok || !body.access_token) {
          throw new Error(`Gmail OAuth token request failed (${response.status}).`);
        }
        return body.access_token;
      })();
    }
    try {
      return await accessTokenPromise;
    } catch (error) {
      accessTokenPromise = null;
      throw error;
    }
  };

  return {
    async send(message) {
      const recipient = String(message?.to || "").trim();
      if (!validEmail(recipient)) throw new Error("Recipient email is invalid.");
      const subject = headerValue(message?.subject);
      const text = String(message?.text || "").replace(/\r?\n/g, "\r\n");
      const mime = [
        `From: ${encodeMimeHeader("游祥龙艺术工作室")} <${fromEmail}>`,
        `To: ${recipient}`,
        `Subject: ${encodeMimeHeader(subject)}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        text,
      ].join("\r\n");
      const response = await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await getAccessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw: base64UrlEncode(mime) }),
      });
      const body = await responseJson(response);
      if (!response.ok || !body.id) {
        throw new Error(`Gmail send failed (${response.status}).`);
      }
      return { id: body.id, to: recipient, subject };
    },
  };
}

function fakeMessageId() {
  return `fake-email-${globalThis.crypto.randomUUID()}`;
}

function buildFakeEmail(row, recipient) {
  const details = parseDetails(row);
  const isOffer = row.template === "admin_offer_customer" || row.template === "customer_offer_admin";
  const isCustomerOffer = row.template === "admin_offer_customer";
  const subject = isCustomerOffer
    ? `游祥龙艺术工作室报价 · ${row.reference}`
    : row.template === "customer_offer_admin"
      ? `游祥龙艺术工作室收到客户报价 · ${row.reference}`
      : `游祥龙艺术工作室收到新的咨询 · ${row.reference}`;
  const lines = [
    isCustomerOffer
      ? `您好，关于作品《${row.artworkTitleZh}》的报价如下：`
      : isOffer
        ? `收到作品《${row.artworkTitleZh}》的新报价。`
        : `收到新的作品咨询：${row.artworkTitleZh}`,
    `咨询编号：${row.reference}`,
  ];
  if (isOffer) {
    lines.push(`报价：${details.amountMinor ?? "-"} ${details.currency ?? ""}`.trim());
  }
  if (isCustomerOffer) {
    lines.push("运输与付款仍需另行协商。");
  } else {
    lines.push(`客户：${row.customerName}`);
    lines.push(`客户邮箱：${row.customerEmail || "未提供"}`);
    lines.push(`联系方式：${row.customerContact}`);
  }
  return { to: recipient, subject, text: lines.join("\n") };
}

export function mapEmailOutbox(row) {
  if (!row) return null;
  return {
    id: row.id,
    notificationEventId: row.notificationEventId,
    orderId: row.orderId,
    recipientKind: row.recipientKind,
    recipientEmail: row.recipientEmail,
    template: row.template,
    status: row.status,
    attemptCount: row.attemptCount,
    providerMessageId: row.providerMessageId,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

export const localFakeEmailProvider = {
  async send(message) {
    // Deliberately does not make a network request or send a real email.
    return { id: fakeMessageId(), to: message.to, subject: message.subject };
  },
};

export function emailDeliveryMode(env = {}) {
  return String(env.EMAIL_MODE || "local-fake").trim().toLowerCase() === "gmail"
    ? "gmail"
    : "local-fake";
}

export function createConfiguredEmailProvider(env) {
  return emailDeliveryMode(env) === "gmail"
    ? createGmailEmailProvider(env)
    : localFakeEmailProvider;
}

export async function dispatchConfiguredEmails(
  db,
  env,
  { maxAttempts = EMAIL_OUTBOX_MAX_ATTEMPTS } = {},
) {
  const mode = emailDeliveryMode(env);
  const result = await dispatchLocalFakeEmails(db, {
    adminEmail: env?.ADMIN_EMAIL,
    provider: createConfiguredEmailProvider(env),
    maxAttempts,
  });
  return { mode, result };
}

export function scheduleConfiguredEmailDispatch(
  context,
  { dispatch = dispatchConfiguredEmails } = {},
) {
  if (emailDeliveryMode(context?.env) !== "gmail" || typeof context?.waitUntil !== "function") {
    return false;
  }
  const task = Promise.resolve()
    .then(() => dispatch(context.env.DB, context.env))
    .catch((error) => {
      console.error("Background email dispatch failed.", error);
    });
  context.waitUntil(task);
  return true;
}

export async function dispatchLocalFakeEmails(
  db,
  { adminEmail = "", provider = localFakeEmailProvider, maxAttempts = EMAIL_OUTBOX_MAX_ATTEMPTS } = {},
) {
  const result = await db.prepare(DISPATCHABLE_EMAIL_OUTBOX_SQL).bind(maxAttempts).all();
  const rows = result.results || [];
  const summary = { considered: rows.length, sent: 0, failed: 0, skipped: 0, emails: [] };

  for (const row of rows) {
    const recipient = row.recipientKind === "admin" ? String(adminEmail || "").trim() : String(row.recipientEmail || "").trim();
    const attemptCount = Number(row.attemptCount || 0) + 1;
    if (!validEmail(recipient)) {
      await db.prepare(
        `UPDATE email_outbox
         SET status = 'skipped', attempt_count = ?, failure_message = ?, sent_at = NULL
         WHERE id = ? AND status IN ('pending', 'failed')`,
      ).bind(attemptCount - 1, "Recipient email is not configured.", row.id).run();
      summary.skipped++;
      summary.emails.push({ id: row.id, status: "skipped" });
      continue;
    }

    try {
      const message = buildFakeEmail(row, recipient);
      const response = await provider.send(message);
      await db.prepare(
        `UPDATE email_outbox
         SET status = 'sent', attempt_count = ?, provider_message_id = ?, failure_message = '',
             sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND status IN ('pending', 'failed')`,
      ).bind(attemptCount, response?.id || fakeMessageId(), row.id).run();
      summary.sent++;
      summary.emails.push({ id: row.id, status: "sent" });
    } catch (error) {
      const failure = String(error?.message || "Local fake delivery failed").slice(0, 500);
      await db.prepare(
        `UPDATE email_outbox
         SET status = 'failed', attempt_count = ?, failure_message = ?, sent_at = NULL
         WHERE id = ? AND status IN ('pending', 'failed')`,
      ).bind(attemptCount, failure, row.id).run();
      summary.failed++;
      summary.emails.push({ id: row.id, status: "failed" });
    }
  }
  return summary;
}
