import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { onRequest as onPublicCreate } from "../functions/api/orders/index.js";
import { onRequest as onPublicOrder } from "../functions/api/orders/[reference].js";
import { onRequest as onPublicOffer } from "../functions/api/orders/[reference]/offers.js";
import { onRequest as onAdminOrders } from "../functions/api/admin/orders/index.js";
import { onRequest as onAdminOrder } from "../functions/api/admin/orders/[id].js";
import { onRequest as onAdminOffer } from "../functions/api/admin/orders/[id]/offers.js";
import { onRequest as onAdminHold } from "../functions/api/admin/orders/[id]/hold.js";
import { onRequest as onAdminReleaseHold } from "../functions/api/admin/orders/[id]/release-hold.js";
import { onRequest as onAdminNotifications } from "../functions/api/admin/notifications.js";
import { createGmailEmailProvider, dispatchLocalFakeEmails, emailDeliveryMode } from "../functions/_lib/email.js";

const migrationSql = [
  "0001_commerce_foundation.sql",
  "0002_stage3_orders.sql",
  "0003_stage5_followup.sql",
  "0004_stage5_email_outbox.sql",
]
  .map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"))
  .join("\n");

class D1PreparedShim {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1PreparedShim(this.database, this.sql, values);
  }

  first(column) {
    const row = this.database.prepare(this.sql).get(...this.values);
    return column ? row?.[column] : row;
  }

  all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.values) };
  }

  run() {
    const statement = this.database.prepare(this.sql);
    const results = /\bRETURNING\b/i.test(this.sql) ? statement.all(...this.values) : [];
    if (!results.length && !/\bRETURNING\b/i.test(this.sql)) statement.run(...this.values);
    const changes = Number(this.database.prepare("SELECT changes() AS changes").get().changes);
    return { success: true, meta: { changes }, results };
  }
}

function makeD1(failAudit = false, maskBatchChanges = false) {
  const database = new DatabaseSync(":memory:");
  database.exec(migrationSql);
  return {
    prepare(sql) {
      return new D1PreparedShim(database, sql);
    },
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = statements.map((statement) => {
          if (failAudit && /admin_audit_log/.test(statement.sql)) throw new Error("simulated audit failure");
          const result = statement.run();
          if (maskBatchChanges) result.meta.changes = 0;
          return result;
        });
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    database,
    setFailAudit(value) {
      failAudit = value;
    },
  };
}

function jsonRequest(url, method, body, extraHeaders = {}) {
  return new Request(`https://preview.example.test${url}`, {
    method,
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function publicContext(request, db, reference) {
  return { request, params: reference ? { reference } : {}, env: { DB: db } };
}

function adminContext(request, db, id, failAudit = false) {
  return {
    request,
    params: { id },
    env: { DB: db },
    data: { admin: { email: "admin@example.test" } },
    failAudit,
  };
}

async function createInquiry(db, idempotencyKey = "stage3-order-001") {
  return onPublicCreate({
    request: jsonRequest(
      "/api/orders",
      "POST",
      {
        artworkId: "guiquilaixi",
        customerName: "Fixture Buyer",
        customerEmail: "fixture@example.test",
        customerContact: "+86 13800000000",
        customerCountryCode: "CN",
        preferredLanguage: "zh",
        contactNote: "Fixture-only inquiry.",
        shippingNote: "Please discuss shipping separately.",
      },
      { "idempotency-key": idempotencyKey },
    ),
    params: {},
    env: { DB: db },
  });
}

test("public inquiry is server-backed, idempotent, and does not expose contact data", async () => {
  const db = makeD1();
  const response = await createInquiry(db);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.match(body.order.reference, /^YX-[A-F0-9]{32}$/);
  assert.equal(body.order.status, "submitted");
  assert.equal(body.order.artwork.id, "guiquilaixi");
  assert.doesNotMatch(JSON.stringify(body), /fixture@example\.test|13800000000/);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
  assert.equal(db.database.prepare("SELECT customer_contact FROM orders").get().customer_contact, "+86 13800000000");

  const duplicate = await createInquiry(db);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).reused, true);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);

  const status = await onPublicOrder(publicContext(
    new Request(`https://preview.example.test/api/orders/${body.order.reference}`),
    db,
    body.order.reference,
  ));
  assert.equal(status.status, 200);
  assert.equal((await status.json()).order.status, "submitted");
});

test("committed order and offer writes remain successful when batch metadata is unavailable", async () => {
  const db = makeD1(false, true);
  const inquiry = await createInquiry(db, "stage3-batch-metadata-001");
  assert.equal(inquiry.status, 201);
  const reference = (await inquiry.json()).order.reference;

  const customerOffer = await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", {
      amountMinor: 120000,
      currency: "CNY",
      message: "Fixture metadata recovery",
    }),
    db,
    reference,
  ));
  assert.equal(customerOffer.status, 201);

  const orderRow = db.database.prepare("SELECT id, version FROM orders WHERE public_reference = ?").get(reference);
  const adminOffer = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", {
      version: orderRow.version,
      amountMinor: 150000,
      currency: "CNY",
      message: "Fixture metadata recovery",
    }),
    db,
    orderRow.id,
  ));
  assert.equal(adminOffer.status, 201);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM offers").get().count, 2);
});

test("public offer and admin quote move the order through negotiation", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage3-order-002");
  const reference = (await inquiry.json()).order.reference;
  const customerOffer = await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", {
      amountMinor: 120000,
      currency: "cny",
      message: "Fixture counteroffer",
    }),
    db,
    reference,
  ));
  assert.equal(customerOffer.status, 201);
  assert.equal((await customerOffer.json()).offer.proposedBy, "customer");

  const orderRow = db.database.prepare("SELECT id, version FROM orders WHERE public_reference = ?").get(reference);
  assert.equal(orderRow.version, 2);
  const adminOffer = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", {
      version: 2,
      amountMinor: 150000,
      currency: "CNY",
      message: "Fixture administrator quote",
    }),
    db,
    orderRow.id,
  ));
  assert.equal(adminOffer.status, 201);
  assert.equal(adminOffer.headers.get("cache-control"), "no-store");
  const adminBody = await adminOffer.json();
  assert.equal(adminBody.order.status, "negotiating");
  assert.equal(adminBody.order.version, 3);
  assert.equal(adminBody.order.offers.length, 2);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log WHERE action = 'create_offer'").get().count, 1);
});

test("admin hold accepts one offer atomically, prevents new inquiry, and can be released", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage3-order-003");
  const reference = (await inquiry.json()).order.reference;
  await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", { amountMinor: 120000, currency: "CNY", message: "Fixture" }),
    db,
    reference,
  ));
  const orderRow = db.database.prepare("SELECT id, version FROM orders WHERE public_reference = ?").get(reference);
  const offerResponse = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", { version: 2, amountMinor: 150000, currency: "CNY", message: "Fixture" }),
    db,
    orderRow.id,
  ));
  const offerBody = await offerResponse.json();
  const offerId = offerBody.order.offers.find((offer) => offer.proposedBy === "admin").id;

  const holdResponse = await onAdminHold(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/hold`, "POST", { version: 3, offerId, durationMinutes: 60 }),
    db,
    orderRow.id,
  ));
  assert.equal(holdResponse.status, 201);
  const holdBody = await holdResponse.json();
  assert.equal(holdBody.order.status, "awaiting_payment");
  assert.equal(holdBody.order.version, 4);
  assert.ok(holdBody.order.activeHold);
  assert.equal(db.database.prepare("SELECT sale_status FROM artworks WHERE id = 'guiquilaixi'").get().sale_status, "held");
  assert.equal(db.database.prepare("SELECT status FROM offers WHERE id = ?").get(offerId).status, "accepted");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM admin_audit_log WHERE action = 'create_inventory_hold'").get().count, 1);

  const blocked = await createInquiry(db, "stage3-order-004");
  assert.equal(blocked.status, 409);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);

  const release = await onAdminReleaseHold(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/release-hold`, "POST", { version: 4 }),
    db,
    orderRow.id,
  ));
  assert.equal(release.status, 200);
  const releaseBody = await release.json();
  assert.equal(releaseBody.order.status, "negotiating");
  assert.equal(releaseBody.order.version, 5);
  assert.equal(db.database.prepare("SELECT sale_status FROM artworks WHERE id = 'guiquilaixi'").get().sale_status, "available");
  assert.equal(db.database.prepare("SELECT status FROM inventory_holds").get().status, "released");

  const cancelled = await onAdminOrder(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}`, "PATCH", { version: 5, status: "cancelled" }),
    db,
    orderRow.id,
  ));
  assert.equal(cancelled.status, 200);
  const stale = await onAdminOrder(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}`, "PATCH", { version: 5, status: "negotiating" }),
    db,
    orderRow.id,
  ));
  assert.equal(stale.status, 409);
});

test("admin order list is no-store and malformed public input does not write", async () => {
  const db = makeD1();
  const invalid = await onPublicCreate({
    request: jsonRequest("/api/orders", "POST", {
      artworkId: "guiquilaixi'; DROP TABLE orders; --",
      customerName: "Fixture",
      customerContact: "fixture",
      unexpected: "rejected",
    }),
    params: {},
    env: { DB: db },
  });
  assert.equal(invalid.status, 400);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 0);

  const list = await onAdminOrders(adminContext(
    new Request("https://preview.example.test/api/admin/orders"),
    db,
    "unused",
  ));
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.deepEqual((await list.json()).orders, []);
});

test("expired holds are released before a new inquiry checks availability", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage3-order-expiry");
  const reference = (await inquiry.json()).order.reference;
  await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", { amountMinor: 120000, currency: "CNY", message: "Fixture" }),
    db,
    reference,
  ));
  const orderRow = db.database.prepare("SELECT id FROM orders WHERE public_reference = ?").get(reference);
  const offer = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", { version: 2, amountMinor: 150000, currency: "CNY", message: "Fixture" }),
    db,
    orderRow.id,
  ));
  const offerId = (await offer.json()).order.offers.find((item) => item.proposedBy === "admin").id;
  await onAdminHold(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/hold`, "POST", { version: 3, offerId, durationMinutes: 60 }),
    db,
    orderRow.id,
  ));
  db.database.prepare("UPDATE inventory_holds SET expires_at = '2000-01-01T00:00:00.000Z'").run();

  const next = await createInquiry(db, "stage3-order-expiry-next");
  assert.equal(next.status, 201);
  assert.equal(db.database.prepare("SELECT sale_status FROM artworks WHERE id = 'guiquilaixi'").get().sale_status, "available");
  assert.equal(db.database.prepare("SELECT status FROM inventory_holds").get().status, "expired");
  assert.equal(db.database.prepare("SELECT status FROM orders WHERE id = ?").get(orderRow.id).status, "negotiating");
});

test("failed hold audit rolls back offer acceptance and inventory changes", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage3-order-005");
  const reference = (await inquiry.json()).order.reference;
  await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", { amountMinor: 120000, currency: "CNY", message: "Fixture" }),
    db,
    reference,
  ));
  const orderRow = db.database.prepare("SELECT id FROM orders WHERE public_reference = ?").get(reference);
  const offer = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", { version: 2, amountMinor: 150000, currency: "CNY", message: "Fixture" }),
    db,
    orderRow.id,
  ));
  const offerId = (await offer.json()).order.offers.find((item) => item.proposedBy === "admin").id;
  db.setFailAudit(true);
  const response = await onAdminHold(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/hold`, "POST", { version: 3, offerId, durationMinutes: 60 }),
    db,
    orderRow.id,
  ));
  assert.equal(response.status, 503);
  assert.equal(db.database.prepare("SELECT status FROM orders WHERE id = ?").get(orderRow.id).status, "negotiating");
  assert.equal(db.database.prepare("SELECT sale_status FROM artworks WHERE id = 'guiquilaixi'").get().sale_status, "available");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM inventory_holds").get().count, 0);
  assert.equal(db.database.prepare("SELECT status FROM offers WHERE id = ?").get(offerId).status, "pending");
});

test("follow-up fields and notification events stay separate from order stages", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage5-follow-up-001");
  const reference = (await inquiry.json()).order.reference;
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM notification_events WHERE event_type = 'new_inquiry'").get().count, 1);

  const customerOffer = await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", {
      amountMinor: 120000,
      currency: "CNY",
      message: "Fixture follow-up offer",
    }),
    db,
    reference,
  ));
  assert.equal(customerOffer.status, 201);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM notification_events WHERE event_type = 'new_offer'").get().count, 1);

  const orderRow = db.database.prepare("SELECT id, version, status FROM orders WHERE public_reference = ?").get(reference);
  assert.equal(orderRow.status, "negotiating");
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM notification_events WHERE event_type = 'order_status_changed'").get().count, 1);

  const followUp = await onAdminOrder(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}`, "PATCH", {
      version: orderRow.version,
      followUpStatus: "contacting",
      nextFollowUpAt: "2030-01-02T03:04:05.000Z",
      adminNote: "Fixture-only note.",
    }),
    db,
    orderRow.id,
  ));
  assert.equal(followUp.status, 200);
  const followUpBody = await followUp.json();
  assert.equal(followUpBody.order.status, "negotiating");
  assert.deepEqual(followUpBody.order.followUp, {
    status: "contacting",
    nextAt: "2030-01-02T03:04:05.000Z",
    note: "Fixture-only note.",
  });
  assert.equal(followUpBody.order.notificationEvents.length, 3);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM notification_events WHERE event_type = 'order_status_changed'").get().count, 1);

  db.setFailAudit(true);
  const failedFollowUp = await onAdminOrder(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}`, "PATCH", {
      version: followUpBody.order.version,
      followUpStatus: "completed",
    }),
    db,
    orderRow.id,
  ));
  assert.equal(failedFollowUp.status, 503);
  assert.equal(db.database.prepare("SELECT follow_up_status FROM orders WHERE id = ?").get(orderRow.id).follow_up_status, "contacting");
  db.setFailAudit(false);

  db.database.prepare(
    "UPDATE notification_events SET delivery_status = 'failed', attempt_count = 1, failure_message = 'Fixture failure' WHERE event_type = 'new_offer'",
  ).run();
  const failedEvent = db.database.prepare(
    "SELECT delivery_status, attempt_count, failure_message FROM notification_events WHERE event_type = 'new_offer'",
  ).get();
  assert.deepEqual({ ...failedEvent }, { delivery_status: "failed", attempt_count: 1, failure_message: "Fixture failure" });
});

test("local email outbox routes inquiries and quotes without network delivery", async () => {
  const db = makeD1();
  const inquiry = await createInquiry(db, "stage5-email-001");
  const reference = (await inquiry.json()).order.reference;
  const inquiryEmail = db.database.prepare(
    "SELECT recipient_kind, recipient_email, template, status FROM email_outbox WHERE template = 'inquiry_admin'",
  ).get();
  assert.deepEqual({ ...inquiryEmail }, {
    recipient_kind: "admin",
    recipient_email: "",
    template: "inquiry_admin",
    status: "pending",
  });

  const firstDispatch = await onAdminNotifications({
    request: new Request("https://preview.example.test/api/admin/notifications", { method: "POST" }),
    params: {},
    env: { DB: db, ADMIN_EMAIL: "admin@example.test" },
  });
  assert.equal(firstDispatch.status, 200);
  assert.equal((await firstDispatch.json()).result.sent, 1);
  assert.equal(db.database.prepare("SELECT status FROM email_outbox WHERE template = 'inquiry_admin'").get().status, "sent");

  const customerOffer = await onPublicOffer(publicContext(
    jsonRequest(`/api/orders/${reference}/offers`, "POST", {
      amountMinor: 120000,
      currency: "CNY",
      message: "Fixture customer offer",
    }),
    db,
    reference,
  ));
  assert.equal(customerOffer.status, 201);
  const orderRow = db.database.prepare("SELECT id, version FROM orders WHERE public_reference = ?").get(reference);
  const adminOffer = await onAdminOffer(adminContext(
    jsonRequest(`/api/admin/orders/${orderRow.id}/offers`, "POST", {
      version: orderRow.version,
      amountMinor: 150000,
      currency: "CNY",
      message: "Fixture administrator offer",
    }),
    db,
    orderRow.id,
  ));
  assert.equal(adminOffer.status, 201);
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM email_outbox").get().count, 3);

  let calls = 0;
  const customerEmail = db.database.prepare(
    "SELECT id FROM email_outbox WHERE template = 'admin_offer_customer'",
  ).get().id;
  db.database.prepare("UPDATE email_outbox SET status = 'sent' WHERE template = 'customer_offer_admin'").run();
  db.database.prepare("UPDATE email_outbox SET status = 'failed', attempt_count = 1 WHERE id = ?").run(customerEmail);
  const failed = await dispatchLocalFakeEmails(db, {
    adminEmail: "admin@example.test",
    provider: { async send() { calls++; throw new Error("fixture provider failure"); } },
  });
  assert.equal(failed.failed, 1);
  assert.equal(db.database.prepare("SELECT status, attempt_count FROM email_outbox WHERE id = ?").get(customerEmail).status, "failed");

  const delivered = [];
  const retried = await dispatchLocalFakeEmails(db, {
    adminEmail: "admin@example.test",
    provider: { async send(message) { delivered.push(message); return { id: "fake-retry" }; } },
  });
  assert.equal(retried.sent, 1);
  assert.equal(calls, 1);
  assert.equal(delivered[0].to, "fixture@example.test");
  assert.equal(db.database.prepare("SELECT status, provider_message_id FROM email_outbox WHERE id = ?").get(customerEmail).status, "sent");
});

test("Gmail provider exchanges OAuth refresh token and sends encoded MIME without live network", async () => {
  const calls = [];
  const provider = createGmailEmailProvider(
    {
      GMAIL_FROM_EMAIL: "studio@example.test",
      GMAIL_CLIENT_ID: "fixture-client-id",
      GMAIL_CLIENT_SECRET: "fixture-client-secret",
      GMAIL_REFRESH_TOKEN: "fixture-refresh-token",
    },
    {
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        if (url === "https://oauth2.googleapis.com/token") {
          return new Response(JSON.stringify({ access_token: "fixture-access-token" }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "gmail-fixture-message-id" }), { status: 200 });
      },
    },
  );

  const sent = await provider.send({ to: "customer@example.test", subject: "报价通知", text: "Fixture body" });
  assert.deepEqual(sent, { id: "gmail-fixture-message-id", to: "customer@example.test", subject: "报价通知" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.match(String(calls[0].init.body), /grant_type=refresh_token/);
  assert.equal(calls[1].url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  assert.equal(calls[1].init.headers.authorization, "Bearer fixture-access-token");
  const raw = JSON.parse(calls[1].init.body).raw;
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - raw.length % 4) % 4);
  const mime = Buffer.from(padded, "base64").toString("utf8");
  assert.match(mime, /From: =\?UTF-8\?B\?.+\?= <studio@example\.test>/);
  assert.match(mime, /To: customer@example\.test/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?.+\?=/);
  assert.match(mime, /Fixture body/);
});

test("email delivery stays local unless Gmail mode is explicitly selected", () => {
  assert.equal(emailDeliveryMode({}), "local-fake");
  assert.equal(emailDeliveryMode({ EMAIL_MODE: "gmail" }), "gmail");
  assert.equal(emailDeliveryMode({ EMAIL_MODE: "unexpected" }), "local-fake");
});
