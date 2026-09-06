// ===== admin.js - server-backed artwork and site-content management =====
// Only the old browser-local inquiry archive remains a legacy feature.

let adminWorks = [];
let adminOrders = [];
let adminEmails = [];
let emailMode = "local-fake";
let emailOutboxError = "";
let selectedOrderId = "";
let adminContentProfile = null;
let adminContentEntries = [];
let selectedContentEntryId = "";
let mediaIntegrityReport = null;
let mediaIntegrityFailed = false;
let workListPage = 1;
const WORKS_PER_PAGE = 10;
const REQUEST_TIMEOUT_MS = 15000;
const PROFILE_FORM_FIELDS = [
  "artistNameZh", "artistNameEn", "artistBioZh", "artistBioEn",
  "artistStatementZh", "artistStatementEn", "heroTitleZh", "heroTitleEn",
  "heroTextZh", "heroTextEn", "heroRecordZh", "heroRecordEn",
  "contactTextZh", "contactTextEn", "contactProcessZh", "contactProcessEn",
  "contactInfoTextZh", "contactInfoTextEn", "activityIntroZh", "activityIntroEn",
];

function setAdminStatus(message, isError = false) {
  const node = byId("adminStatus");
  node.textContent = message;
  node.style.color = isError ? "var(--accent)" : "";
}

async function requestJson(path, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let body = null;
  try {
    response = await fetch(path, { ...fetchOptions, headers, cache: "no-store", signal: controller.signal });
    try {
      body = await response.json();
    } catch (cause) {
      if (controller.signal.aborted) throw cause;
    }
  } catch (cause) {
    const timedOut = controller.signal.aborted || cause?.name === "AbortError";
    const error = new Error(timedOut ? "Request timed out." : "Network unavailable.");
    error.code = timedOut ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE";
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message || "Request failed.");
    error.status = response.status;
    error.code = body?.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return body;
}

function requestFailureText(error, fallbackKey = "adminSaveFailed") {
  if (error?.code === "REQUEST_TIMEOUT") return t("adminRequestTimeout");
  if (error?.code === "NETWORK_UNAVAILABLE") return t("adminNetworkUnavailable");
  return t(fallbackKey);
}

function mediaFailureText(error) {
  if (error?.code === "MEDIA_STORAGE_NOT_CONFIGURED") return t("mediaStorageUnavailable");
  if (String(error?.code || "").startsWith("MEDIA_") || error?.status === 413 || error?.status === 415) {
    return t("mediaInvalid");
  }
  return requestFailureText(error);
}

function formatMediaBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function mediaSummary(work) {
  if (!work?.image) return t("mediaMissing");
  if (!work?.mediaId) return t("mediaLegacyActive");
  return t("mediaStoredActive")
    .replace("{name}", work.mediaFilename || "image")
    .replace("{width}", work.mediaWidth || "-")
    .replace("{height}", work.mediaHeight || "-")
    .replace("{size}", formatMediaBytes(work.mediaByteSize));
}

function replaceTokens(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function renderMediaIntegrity() {
  const panel = byId("mediaIntegrityPanel");
  const status = byId("mediaIntegrityStatus");
  const issues = byId("mediaIntegrityIssues");
  issues.replaceChildren();

  if (mediaIntegrityFailed) {
    panel.dataset.state = "error";
    status.textContent = t("mediaIntegrityFailed");
    issues.hidden = true;
    return;
  }
  if (!mediaIntegrityReport) {
    panel.dataset.state = "idle";
    status.textContent = t("mediaIntegrityIdle");
    issues.hidden = true;
    return;
  }

  const categories = [
    ["mediaIssueMissing", mediaIntegrityReport.issues?.missingObjects?.length || 0],
    ["mediaIssueOrphan", mediaIntegrityReport.issues?.orphanObjects?.length || 0],
    ["mediaIssueUnlinked", mediaIntegrityReport.issues?.unlinkedActiveMedia?.length || 0],
    ["mediaIssueInvalidReference", mediaIntegrityReport.issues?.invalidPrimaryReferences?.length || 0],
  ].filter(([, count]) => count > 0);

  panel.dataset.state = mediaIntegrityReport.healthy ? "healthy" : "issues";
  status.textContent = mediaIntegrityReport.healthy
    ? replaceTokens(t("mediaIntegrityHealthy"), {
      database: mediaIntegrityReport.totals?.databaseAssets || 0,
      bucket: mediaIntegrityReport.totals?.bucketObjects || 0,
    })
    : replaceTokens(t("mediaIntegrityIssues"), { count: categories.length });
  for (const [key, count] of categories) {
    issues.append(textElement("li", replaceTokens(t(key), { count })));
  }
  issues.hidden = categories.length === 0;
}

function textElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text ?? "";
  if (className) element.className = className;
  return element;
}

function currencyMinorFactor(currency) {
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: String(currency || "CNY").toUpperCase(),
    }).resolvedOptions().maximumFractionDigits;
    return 10 ** digits;
  } catch {
    return 100;
  }
}

function amountFromMinor(amountMinor, currency) {
  if (amountMinor === null || amountMinor === undefined || amountMinor === "") return "";
  return Number(amountMinor) / currencyMinorFactor(currency);
}

function amountToMinor(amount, currency) {
  if (amount === "") return null;
  return Math.round(Number(amount) * currencyMinorFactor(currency));
}

function formatMoneyMinor(amountMinor, currency = "CNY") {
  if (!Number.isFinite(Number(amountMinor))) return "-";
  const normalizedCurrency = String(currency || "CNY").toUpperCase();
  return new Intl.NumberFormat(state.language === "zh" ? "zh-CN" : "en", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountFromMinor(amountMinor, normalizedCurrency));
}

function syncWorkFilterOptions() {
  const categoryFilter = byId("workCategoryFilter");
  const statusFilter = byId("workStatusFilter");
  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;
  const categories = [...new Set(adminWorks.map((work) => work.category).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, state.language === "zh" ? "zh-CN" : "en"));
  categoryFilter.replaceChildren(
    new Option(t("allWorkSeries"), "all"),
    ...categories.map((category) => new Option(category, category)),
  );
  statusFilter.replaceChildren(
    new Option(t("allWorkStatuses"), "all"),
    ...["available", "sold", "not_for_sale"].map((status) => new Option(t(status), status)),
  );
  categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "all";
  statusFilter.value = ["available", "sold", "not_for_sale"].includes(selectedStatus) ? selectedStatus : "all";
}

function filteredAdminWorks() {
  const query = byId("workSearch").value.trim().toLocaleLowerCase();
  const category = byId("workCategoryFilter").value || "all";
  const status = byId("workStatusFilter").value || "all";
  return adminWorks.filter((work) => {
    const haystack = `${work.titleZh} ${work.titleEn} ${work.category} ${work.year}`.toLocaleLowerCase();
    return (!query || haystack.includes(query))
      && (category === "all" || work.category === category)
      && (status === "all" || work.saleStatus === status);
  });
}

function renderStatusOptions() {
  byId("status").replaceChildren(
    ...["available", "sold", "not_for_sale"].map((value) => new Option(t(value), value)),
  );
  byId("contentStatus").replaceChildren(
    ...["draft", "published", "archived"].map((value) => new Option(t(value), value)),
  );
  byId("contentEntryKind").replaceChildren(
    ...["timeline", "activity", "person", "collaboration"].map(
      (value) => new Option(t(`${value}Entry`), value),
    ),
  );
  byId("contentEntryStatus").replaceChildren(
    ...["draft", "published", "archived"].map((value) => new Option(t(value), value)),
  );
}

function renderAdminWorks() {
  const list = byId("workAdminList");
  list.replaceChildren();
  syncWorkFilterOptions();
  if (!adminWorks.length) {
    list.append(textElement("div", t("empty"), "empty-state"));
    byId("workResultCount").textContent = replaceTokens(t("workResultCount"), { count: 0 });
    byId("workPageStatus").textContent = replaceTokens(t("workPageStatus"), { page: 1, pages: 1 });
    byId("previousWorkPage").disabled = true;
    byId("nextWorkPage").disabled = true;
    return;
  }
  const filteredWorks = filteredAdminWorks();
  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / WORKS_PER_PAGE));
  workListPage = Math.min(Math.max(workListPage, 1), totalPages);
  byId("workResultCount").textContent = replaceTokens(t("workResultCount"), { count: filteredWorks.length });
  byId("workPageStatus").textContent = replaceTokens(t("workPageStatus"), { page: workListPage, pages: totalPages });
  byId("previousWorkPage").disabled = workListPage <= 1;
  byId("nextWorkPage").disabled = workListPage >= totalPages;
  if (!filteredWorks.length) {
    list.append(textElement("div", t("galleryEmpty"), "empty-state"));
    return;
  }
  const start = (workListPage - 1) * WORKS_PER_PAGE;
  for (const work of filteredWorks.slice(start, start + WORKS_PER_PAGE)) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const image = work.image
      ? document.createElement("img")
      : textElement("div", t("imagePending"), "admin-image-placeholder");
    if (work.image) {
      image.src = work.image;
      image.alt = work.titleZh;
    }
    const copy = document.createElement("div");
    copy.append(
      textElement("h3", work.titleZh),
      textElement(
        "p",
        [work.category, work.dimensions, work.year, t(work.saleStatus)].filter(Boolean).join(" · "),
      ),
      textElement("p", `v${work.version}`, "form-note"),
    );
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const edit = textElement("button", t("edit"), "icon-button");
    edit.type = "button";
    edit.dataset.editWork = work.id;
    actions.append(edit);
    item.append(image, copy, actions);
    list.append(item);
  }
}

function selectedOrder() {
  return adminOrders.find((order) => order.id === selectedOrderId) || null;
}

function followUpData(order) {
  return order.followUp || { status: "unprocessed", nextAt: null, note: "" };
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid follow-up time");
  return date.toISOString();
}

function filteredAndSortedOrders() {
  const filter = byId("orderFollowUpFilter").value;
  const sort = byId("orderSort").value;
  const orders = adminOrders.filter((order) => filter === "all" || followUpData(order).status === filter);
  return orders.sort((left, right) => {
    const leftFollowUp = followUpData(left).nextAt;
    const rightFollowUp = followUpData(right).nextAt;
    if (sort === "followUp") {
      if (!leftFollowUp && !rightFollowUp) return String(right.updatedAt).localeCompare(String(left.updatedAt));
      if (!leftFollowUp) return 1;
      if (!rightFollowUp) return -1;
      return String(leftFollowUp).localeCompare(String(rightFollowUp));
    }
    const leftValue = sort === "created" ? left.createdAt : left.updatedAt;
    const rightValue = sort === "created" ? right.createdAt : right.updatedAt;
    return String(rightValue).localeCompare(String(leftValue));
  });
}

function orderStatusTargets(status) {
  return {
    submitted: ["negotiating", "cancelled"],
    negotiating: ["awaiting_payment", "cancelled"],
    awaiting_payment: ["cancelled"],
    cancelled: [],
  }[status] || [];
}

function renderOrderTools() {
  const order = selectedOrder();
  const summary = byId("selectedOrderSummary");
  const offerForm = byId("offerForm");
  const holdForm = byId("holdForm");
  const statusForm = byId("orderStatusForm");
  const followUpForm = byId("followUpForm");
  if (!order) {
    summary.textContent = t("selectOrder");
    offerForm.hidden = true;
    holdForm.hidden = true;
    statusForm.hidden = true;
    followUpForm.hidden = true;
    byId("notificationEventList").replaceChildren();
    return;
  }

  summary.textContent = `${order.artwork.titleZh} · ${order.customer.name} · ${order.customer.contact} · ${t(order.status)} · v${order.version}`;
  offerForm.hidden = !["submitted", "negotiating"].includes(order.status);
  holdForm.hidden = !["negotiating", "awaiting_payment"].includes(order.status);
  statusForm.hidden = false;

  const pendingOffers = (order.offers || []).filter((offer) => offer.status === "pending");
  const offerSelect = byId("holdOffer");
  offerSelect.replaceChildren(
    ...pendingOffers.map((offer) => new Option(
      `${t(offer.proposedBy === "admin" ? "adminOffer" : "customerOffer")} · ${formatMoneyMinor(offer.amountMinor, offer.currency)}`,
      offer.id,
    )),
  );
  byId("createHold").disabled = !pendingOffers.length || Boolean(order.activeHold);
  byId("releaseHold").disabled = !order.activeHold;
  const statusSelect = byId("orderStatus");
  const statusButton = statusForm.querySelector('button[type="submit"]');
  const targets = orderStatusTargets(order.status);
  statusSelect.replaceChildren();
  if (targets.length) {
    const placeholder = new Option(t("selectNextOrderStatus"), "", true, true);
    placeholder.disabled = true;
    statusSelect.append(placeholder, ...targets.map((value) => new Option(t(value), value)));
  } else {
    const current = new Option(t(order.status), order.status, true, true);
    current.disabled = true;
    statusSelect.append(current);
  }
  statusSelect.disabled = !targets.length;
  statusButton.disabled = !targets.length;
  statusSelect.onchange = () => {
    statusButton.disabled = !targets.includes(statusSelect.value);
  };
  byId("orderStatusNote").textContent = order.status === "cancelled" ? t("cancelledOrderReadonly") : "";

  const followUp = followUpData(order);
  followUpForm.hidden = false;
  byId("followUpStatus").value = followUp.status;
  byId("nextFollowUpAt").value = toDateTimeInput(followUp.nextAt);
  byId("adminNote").value = followUp.note || "";
  const eventList = byId("notificationEventList");
  eventList.replaceChildren();
  if (!(order.notificationEvents || []).length) {
    eventList.append(textElement("div", t("noNotificationEvents"), "empty-state"));
  } else {
    for (const event of order.notificationEvents) {
      const item = document.createElement("div");
      item.className = "admin-item";
      item.append(
        document.createElement("div"),
        textElement("div", `${t(event.eventType)} · ${formatDateTime(event.createdAt)}`),
        textElement("div", t(event.deliveryStatus === "failed" ? "notificationEventFailed" : "notificationEventRecorded"), "form-note"),
      );
      eventList.append(item);
    }
  }
}

function renderAdminOrders() {
  const list = byId("orderAdminList");
  list.replaceChildren();
  if (!adminOrders.length) {
    list.append(textElement("div", t("noOrders"), "empty-state"));
    renderOrderTools();
    return;
  }
  const orders = filteredAndSortedOrders();
  if (!orders.length) {
    list.append(textElement("div", t("noMatchingOrders"), "empty-state"));
    renderOrderTools();
    return;
  }
  for (const order of orders) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const image = document.createElement("img");
    image.src = order.artwork.image;
    image.alt = order.artwork.titleZh;
    const copy = document.createElement("div");
    copy.append(
      textElement("h3", order.artwork.titleZh),
      textElement("p", `${order.customer.name} · ${order.customer.contact}`),
      textElement("p", `${t(order.status)} · v${order.version} · ${order.reference}`, "form-note"),
      textElement("p", `${t(followUpData(order).status)} · ${formatDateTime(followUpData(order).nextAt)}`),
    );
    if (order.latestOffer) {
      copy.append(textElement(
        "p",
        `${t(order.latestOffer.proposedBy === "admin" ? "adminOffer" : "customerOffer")} · ${formatMoneyMinor(order.latestOffer.amountMinor, order.latestOffer.currency)} · ${t(order.latestOffer.status)}`,
      ));
    }
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const select = textElement("button", t("edit"), "icon-button");
    select.type = "button";
    select.dataset.selectOrder = order.id;
    actions.append(select);
    item.append(image, copy, actions);
    list.append(item);
  }
  renderOrderTools();
}

function renderEmailOutbox() {
  const modeLabel = byId("emailOutboxMode");
  modeLabel.textContent = t(emailMode === "gmail" ? "gmailEmailOutbox" : "localEmailOutbox");
  byId("dispatchEmailOutbox").textContent = t(emailMode === "gmail" ? "dispatchEmailOutboxReal" : "dispatchEmailOutbox");
  const list = byId("emailOutboxList");
  list.replaceChildren();
  if (emailOutboxError) {
    list.append(textElement("div", t(emailOutboxError), "empty-state is-error"));
    return;
  }
  if (!adminEmails.length) {
    list.append(textElement("div", t("emailOutboxEmpty"), "empty-state"));
    return;
  }
  for (const email of adminEmails) {
    const item = document.createElement("div");
    item.className = "admin-item";
    item.append(
      document.createElement("div"),
      textElement("div", `${t(email.recipientKind === "admin" ? "adminRecipient" : "customerRecipient")} · ${t(email.template)}`),
      textElement("div", `${t(email.status === "sent" && emailMode === "gmail" ? "sentReal" : email.status)} · ${email.attemptCount}`, "form-note"),
    );
    list.append(item);
  }
}

function syncAdminOrder(order) {
  adminOrders = adminOrders.map((item) => (item.id === order.id ? order : item));
  selectedOrderId = order.id;
  renderAdminOrders();
}

async function selectAdminOrder(id) {
  selectedOrderId = id;
  renderAdminOrders();
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(id)}`);
    syncAdminOrder(result.order);
  } catch (error) {
    setAdminStatus(requestFailureText(error, "adminAccessUnavailable"), true);
  }
}

function renderContentEntries() {
  const list = byId("peopleList");
  list.replaceChildren();
  if (!adminContentEntries.length) {
    list.append(textElement("div", t("empty"), "empty-state"));
    return;
  }
  for (const entry of adminContentEntries) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const copy = document.createElement("div");
    const title = localText(entry, "titleZh", "titleEn") || localText(entry, "bodyZh", "bodyEn");
    copy.append(
      textElement("h3", title),
      textElement("p", `${t(`${entry.kind}Entry`)} · ${entry.yearLabel || "-"} · ${t(entry.contentStatus)} · v${entry.version}`),
      textElement("p", localText(entry, "bodyZh", "bodyEn"), "content-entry-summary"),
    );
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const edit = textElement("button", t("edit"), "icon-button");
    edit.type = "button";
    edit.dataset.editContentEntry = entry.id;
    actions.append(edit);
    if (entry.contentStatus !== "archived") {
      const archive = textElement("button", t("archiveEntry"), "icon-button");
      archive.type = "button";
      archive.dataset.archiveContentEntry = entry.id;
      actions.append(archive);
    }
    item.append(document.createElement("div"), copy, actions);
    list.append(item);
  }
}

function renderInquiries() {
  const list = byId("inquiryList");
  list.replaceChildren();
  if (!state.inquiries.length) {
    list.append(textElement("div", t("noInquiries"), "empty-state"));
    return;
  }
  for (const inquiry of state.inquiries) {
    const work = state.works.find((item) => item.id === inquiry.workId);
    const item = document.createElement("div");
    item.className = "admin-item";
    const copy = document.createElement("div");
    copy.append(
      textElement("h3", work?.titleZh || inquiry.workId),
      textElement("p", `${inquiry.name} · ${inquiry.contact}`),
      textElement("p", inquiry.message || ""),
    );
    item.append(document.createElement("div"), copy, textElement("div", inquiry.date));
    list.append(item);
  }
}

function fillContentProfileForm() {
  if (!adminContentProfile) return;
  byId("contentProfileVersion").value = adminContentProfile.version;
  for (const field of PROFILE_FORM_FIELDS) byId(field).value = adminContentProfile[field] || "";
  byId("restoreContentProfile").disabled = !adminContentProfile.canRestore;
}

function resetContentEntryForm() {
  byId("peopleForm").reset();
  selectedContentEntryId = "";
  byId("contentEntryId").value = "";
  byId("contentEntryVersion").value = "";
  byId("contentEntryStatus").value = "draft";
  const nextOrder = adminContentEntries.reduce((maximum, entry) => Math.max(maximum, entry.displayOrder || 0), 0) + 1;
  byId("contentDisplayOrder").value = Math.min(nextOrder, 100000);
  byId("restoreContentEntry").disabled = true;
}

function fillContentEntryForm(entry, { scroll = true } = {}) {
  selectedContentEntryId = entry.id;
  byId("contentEntryId").value = entry.id;
  byId("contentEntryVersion").value = entry.version;
  byId("contentEntryKind").value = entry.kind;
  byId("contentYearLabel").value = entry.yearLabel;
  byId("contentTitleZh").value = entry.titleZh;
  byId("contentTitleEn").value = entry.titleEn;
  byId("contentBodyZh").value = entry.bodyZh;
  byId("contentBodyEn").value = entry.bodyEn;
  byId("contentSourceUrl").value = entry.sourceUrl;
  byId("contentEntryStatus").value = entry.contentStatus;
  byId("contentDisplayOrder").value = entry.displayOrder;
  byId("restoreContentEntry").disabled = !entry.canRestore;
  if (scroll) byId("peopleForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetWorkForm() {
  byId("workForm").reset();
  byId("workId").value = "";
  byId("workVersion").value = "";
  byId("workDisplayOrder").value = "0";
  byId("currency").value = "CNY";
  byId("contentStatus").value = "published";
  byId("status").value = "available";
  byId("negotiationEnabled").checked = true;
  byId("mediaFile").value = "";
  byId("uploadMedia").disabled = true;
  byId("restoreMedia").disabled = true;
  byId("mediaCurrent").textContent = t("mediaLegacyActive");
  setAdminStatus(t("adminWorkEditOnly"));
}

function fillWorkForm(work) {
  byId("workId").value = work.id;
  byId("workVersion").value = work.version;
  byId("workDisplayOrder").value = work.displayOrder;
  byId("titleZh").value = work.titleZh;
  byId("titleEn").value = work.titleEn;
  byId("category").value = work.category;
  byId("medium").value = work.medium;
  byId("size").value = work.dimensions;
  byId("year").value = work.year;
  byId("currency").value = work.currency;
  byId("price").value = amountFromMinor(work.priceMinor, work.currency);
  byId("status").value = work.saleStatus;
  byId("contentStatus").value = work.contentStatus;
  byId("hidePrice").checked = work.priceVisibility === "private_quote";
  byId("negotiationEnabled").checked = work.negotiationEnabled;
  byId("image").value = work.image;
  byId("mediaPreview").hidden = !work.image;
  if (work.image) byId("mediaPreview").src = work.image;
  else byId("mediaPreview").removeAttribute("src");
  byId("mediaPreview").alt = work.titleZh;
  byId("mediaCurrent").textContent = mediaSummary(work);
  byId("mediaFile").value = "";
  byId("uploadMedia").disabled = true;
  byId("restoreMedia").disabled = !work.mediaCanRestore;
  byId("descriptionZh").value = work.descriptionZh;
  byId("descriptionEn").value = work.descriptionEn;
  location.hash = "admin";
}

function workPatchFromForm() {
  const price = byId("price").value.trim();
  return {
    version: Number(byId("workVersion").value),
    titleZh: byId("titleZh").value.trim(),
    titleEn: byId("titleEn").value.trim(),
    category: byId("category").value.trim(),
    medium: byId("medium").value.trim(),
    dimensions: byId("size").value.trim(),
    year: Number(byId("year").value),
    image: byId("image").value.trim(),
    descriptionZh: byId("descriptionZh").value.trim(),
    descriptionEn: byId("descriptionEn").value.trim(),
    contentStatus: byId("contentStatus").value,
    saleStatus: byId("status").value,
    priceMinor: amountToMinor(price, byId("currency").value),
    currency: byId("currency").value.trim().toUpperCase(),
    priceVisibility: byId("hidePrice").checked ? "private_quote" : "on_request",
    negotiationEnabled: byId("negotiationEnabled").checked,
    displayOrder: Number(byId("workDisplayOrder").value),
  };
}

async function loadAdminWorks() {
  setAdminStatus(t("adminLoading"));
  try {
    const result = await requestJson("/api/admin/artworks");
    adminWorks = result.artworks || [];
    renderAdminWorks();
    setAdminStatus(t("adminReady"));
  } catch (error) {
    adminWorks = [];
    renderAdminWorks();
    setAdminStatus(requestFailureText(error, "adminAccessUnavailable"), true);
  }
}

async function loadAdminContent() {
  setAdminStatus(t("contentLoading"));
  try {
    const result = await requestJson("/api/admin/content");
    adminContentProfile = result.profile || null;
    adminContentEntries = result.entries || [];
    if (selectedContentEntryId) {
      const selected = adminContentEntries.find((entry) => entry.id === selectedContentEntryId);
      if (selected) fillContentEntryForm(selected);
      else resetContentEntryForm();
    }
    fillContentProfileForm();
    renderContentEntries();
    setAdminStatus(t("contentReady"));
  } catch (error) {
    adminContentProfile = null;
    adminContentEntries = [];
    renderContentEntries();
    setAdminStatus(requestFailureText(error, "contentLoadFailed"), true);
  }
}

async function loadAdminOrders() {
  setAdminStatus(t("ordersLoading"));
  try {
    const result = await requestJson("/api/admin/orders");
    adminOrders = result.orders || [];
    if (selectedOrderId && !adminOrders.some((order) => order.id === selectedOrderId)) selectedOrderId = "";
    renderAdminOrders();
    if (selectedOrderId) {
      try {
        const result = await requestJson(`/api/admin/orders/${encodeURIComponent(selectedOrderId)}`);
        syncAdminOrder(result.order);
      } catch (error) {
        setAdminStatus(requestFailureText(error, "adminAccessUnavailable"), true);
      }
    }
    setAdminStatus(t("ordersReady"));
  } catch (error) {
    adminOrders = [];
    selectedOrderId = "";
    renderAdminOrders();
    setAdminStatus(requestFailureText(error, "adminAccessUnavailable"), true);
  }
}

async function loadEmailOutbox() {
  try {
    const result = await requestJson("/api/admin/notifications");
    emailMode = result.mode || "local-fake";
    adminEmails = result.emails || [];
    emailOutboxError = "";
    renderEmailOutbox();
  } catch (error) {
    adminEmails = [];
    emailMode = "local-fake";
    emailOutboxError = error?.code === "REQUEST_TIMEOUT"
      ? "emailOutboxTimeout"
      : error?.code === "NETWORK_UNAVAILABLE"
        ? "emailOutboxNetworkFailed"
        : "emailOutboxLoadFailed";
    renderEmailOutbox();
  }
}

function renderLegacyPanels() {
  applyLanguage();
  renderContentEntries();
  renderInquiries();
  fillContentProfileForm();
}

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("is-active"));
    button.classList.add("is-active");
    ["Works", "Artist", "People", "Orders", "Inquiries"].forEach((name) => {
      byId(`admin${name}`).hidden = button.dataset.adminTab !== name.toLowerCase();
    });
    if (button.dataset.adminTab === "orders") {
      loadAdminOrders();
      loadEmailOutbox();
    }
    if (["artist", "people"].includes(button.dataset.adminTab)) loadAdminContent();
  });
});

byId("workForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = byId("workId").value;
  if (!id) {
    setAdminStatus(t("adminWorkEditOnly"), true);
    return;
  }
  const saveButton = byId("workForm").querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    const result = await requestJson(`/api/admin/artworks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(workPatchFromForm()),
    });
    adminWorks = adminWorks.map((work) => (work.id === id ? result.artwork : work));
    renderAdminWorks();
    fillWorkForm(result.artwork);
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    if (error.status === 409) {
      setAdminStatus(t("adminVersionConflict"), true);
    } else {
      setAdminStatus(requestFailureText(error), true);
    }
  } finally {
    saveButton.disabled = false;
  }
});

byId("resetWorkForm").addEventListener("click", resetWorkForm);
byId("reloadWorks").addEventListener("click", loadAdminWorks);
for (const id of ["workSearch", "workCategoryFilter", "workStatusFilter"]) {
  byId(id).addEventListener(id === "workSearch" ? "input" : "change", () => {
    workListPage = 1;
    renderAdminWorks();
  });
}
byId("previousWorkPage").addEventListener("click", () => {
  if (workListPage <= 1) return;
  workListPage -= 1;
  renderAdminWorks();
});
byId("nextWorkPage").addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(filteredAdminWorks().length / WORKS_PER_PAGE));
  if (workListPage >= totalPages) return;
  workListPage += 1;
  renderAdminWorks();
});
byId("checkMediaIntegrity").addEventListener("click", async () => {
  const button = byId("checkMediaIntegrity");
  button.disabled = true;
  mediaIntegrityFailed = false;
  byId("mediaIntegrityPanel").dataset.state = "loading";
  byId("mediaIntegrityStatus").textContent = t("mediaIntegrityChecking");
  byId("mediaIntegrityIssues").hidden = true;
  try {
    mediaIntegrityReport = await requestJson("/api/admin/media-integrity");
  } catch {
    mediaIntegrityReport = null;
    mediaIntegrityFailed = true;
  } finally {
    renderMediaIntegrity();
    button.disabled = false;
  }
});
byId("mediaFile").addEventListener("change", () => {
  byId("uploadMedia").disabled = !byId("workId").value || !byId("mediaFile").files?.length;
});
byId("uploadMedia").addEventListener("click", async () => {
  const id = byId("workId").value;
  const file = byId("mediaFile").files?.[0];
  if (!id || !file) {
    setAdminStatus(t("mediaFileRequired"), true);
    return;
  }
  const button = byId("uploadMedia");
  button.disabled = true;
  byId("restoreMedia").disabled = true;
  setAdminStatus(t("mediaUploading"));
  const form = new FormData();
  form.append("version", byId("workVersion").value);
  form.append("file", file, file.name);
  try {
    const result = await requestJson(`/api/admin/artworks/${encodeURIComponent(id)}/media`, {
      method: "POST",
      body: form,
      timeoutMs: 60000,
    });
    adminWorks = adminWorks.map((work) => (work.id === id ? result.artwork : work));
    renderAdminWorks();
    fillWorkForm(result.artwork);
    setAdminStatus(t("mediaUploaded"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : mediaFailureText(error), true);
    button.disabled = false;
  }
});
byId("restoreMedia").addEventListener("click", async () => {
  const id = byId("workId").value;
  if (!id) return;
  const button = byId("restoreMedia");
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/artworks/${encodeURIComponent(id)}/media/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: Number(byId("workVersion").value) }),
    });
    adminWorks = adminWorks.map((work) => (work.id === id ? result.artwork : work));
    renderAdminWorks();
    fillWorkForm(result.artwork);
    setAdminStatus(t("mediaRestored"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    button.disabled = false;
  }
});
byId("reloadOrders").addEventListener("click", loadAdminOrders);
byId("dispatchEmailOutbox").addEventListener("click", async () => {
  const button = byId("dispatchEmailOutbox");
  button.disabled = true;
  try {
    const result = await requestJson("/api/admin/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await loadEmailOutbox();
    const summary = result.result || {};
    const resultLabel = emailMode === "gmail" ? t("emailDispatchResultReal") : t("emailDispatchResult");
    const sentLabel = emailMode === "gmail" ? t("sentReal") : t("sent");
    setAdminStatus(`${resultLabel} ${summary.sent || 0} ${sentLabel} / ${summary.failed || 0} ${t("failed")} / ${summary.skipped || 0} ${t("skipped")}`);
  } catch (error) {
    setAdminStatus(requestFailureText(error), true);
  } finally {
    button.disabled = false;
  }
});
byId("orderFollowUpFilter").addEventListener("change", renderAdminOrders);
byId("orderSort").addEventListener("change", renderAdminOrders);

byId("offerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const order = selectedOrder();
  if (!order) return;
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(order.id)}/offers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: order.version,
        amountMinor: amountToMinor(
          byId("orderOfferAmount").value,
          byId("orderOfferCurrency").value,
        ),
        currency: byId("orderOfferCurrency").value.trim().toUpperCase(),
        message: byId("orderOfferMessage").value.trim(),
      }),
    });
    syncAdminOrder(result.order);
    event.target.reset();
    byId("orderOfferCurrency").value = "CNY";
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminOrders();
  } finally {
    button.disabled = false;
  }
});

byId("holdForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const order = selectedOrder();
  if (!order) return;
  const button = byId("createHold");
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(order.id)}/hold`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: order.version,
        offerId: byId("holdOffer").value,
        durationMinutes: Number(byId("holdDuration").value),
      }),
    });
    syncAdminOrder(result.order);
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminOrders();
  } finally {
    button.disabled = false;
  }
});

byId("releaseHold").addEventListener("click", async () => {
  const order = selectedOrder();
  if (!order?.activeHold) return;
  const button = byId("releaseHold");
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(order.id)}/release-hold`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: order.version }),
    });
    syncAdminOrder(result.order);
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminOrders();
  } finally {
    button.disabled = false;
  }
});

byId("orderStatusForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const order = selectedOrder();
  if (!order) return;
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: order.version, status: byId("orderStatus").value }),
    });
    syncAdminOrder(result.order);
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    setAdminStatus(
      error.status === 409
        ? t("adminVersionConflict")
        : error.code === "INVALID_ORDER_TRANSITION"
          ? t("orderStatusInvalid")
          : requestFailureText(error),
      true,
    );
    if (error.status === 409) await loadAdminOrders();
  } finally {
    button.disabled = false;
  }
});

byId("followUpForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const order = selectedOrder();
  if (!order) return;
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: order.version,
        followUpStatus: byId("followUpStatus").value,
        nextFollowUpAt: toIsoOrNull(byId("nextFollowUpAt").value),
        adminNote: byId("adminNote").value.trim(),
      }),
    });
    syncAdminOrder(result.order);
    setAdminStatus(t("adminSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminOrders();
  } finally {
    button.disabled = false;
  }
});

byId("artistForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminContentProfile) return;
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  const payload = { version: Number(byId("contentProfileVersion").value) };
  for (const field of PROFILE_FORM_FIELDS) {
    const value = byId(field).value.trim();
    if (value !== adminContentProfile[field]) payload[field] = value;
  }
  if (Object.keys(payload).length === 1) {
    button.disabled = false;
    setAdminStatus(t("contentReady"));
    return;
  }
  try {
    const result = await requestJson("/api/admin/content/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    adminContentProfile = { ...result.profile, canRestore: true };
    fillContentProfileForm();
    setAdminStatus(t("contentSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminContent();
  } finally {
    button.disabled = false;
  }
});

byId("peopleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  const payload = {
    kind: byId("contentEntryKind").value,
    yearLabel: byId("contentYearLabel").value.trim(),
    titleZh: byId("contentTitleZh").value.trim(),
    titleEn: byId("contentTitleEn").value.trim(),
    bodyZh: byId("contentBodyZh").value.trim(),
    bodyEn: byId("contentBodyEn").value.trim(),
    sourceUrl: byId("contentSourceUrl").value.trim(),
    contentStatus: byId("contentEntryStatus").value,
    displayOrder: Number(byId("contentDisplayOrder").value),
  };
  const editing = Boolean(selectedContentEntryId);
  if (editing) payload.version = Number(byId("contentEntryVersion").value);
  try {
    const result = await requestJson(
      editing ? `/api/admin/content/entries/${encodeURIComponent(selectedContentEntryId)}` : "/api/admin/content/entries",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const entry = { ...result.entry, canRestore: editing };
    const index = adminContentEntries.findIndex((item) => item.id === entry.id);
    if (index >= 0) adminContentEntries[index] = entry;
    else adminContentEntries.push(entry);
    renderContentEntries();
    fillContentEntryForm(entry);
    setAdminStatus(t("contentSaved"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminContent();
  } finally {
    button.disabled = false;
  }
});

byId("newContentEntry").addEventListener("click", resetContentEntryForm);

byId("restoreContentProfile").addEventListener("click", async () => {
  if (!adminContentProfile?.canRestore) return;
  const button = byId("restoreContentProfile");
  button.disabled = true;
  try {
    const result = await requestJson("/api/admin/content/profile/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: adminContentProfile.version }),
    });
    adminContentProfile = { ...result.profile, canRestore: true };
    fillContentProfileForm();
    setAdminStatus(t("contentRestored"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminContent();
  } finally {
    button.disabled = !adminContentProfile?.canRestore;
  }
});

byId("restoreContentEntry").addEventListener("click", async () => {
  const entry = adminContentEntries.find((item) => item.id === selectedContentEntryId);
  if (!entry?.canRestore) return;
  const button = byId("restoreContentEntry");
  button.disabled = true;
  try {
    const result = await requestJson(`/api/admin/content/entries/${encodeURIComponent(entry.id)}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: entry.version }),
    });
    const restored = { ...result.entry, canRestore: true };
    adminContentEntries[adminContentEntries.findIndex((item) => item.id === restored.id)] = restored;
    renderContentEntries();
    fillContentEntryForm(restored);
    setAdminStatus(t("contentRestored"));
  } catch (error) {
    setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
    if (error.status === 409) await loadAdminContent();
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-work]");
  if (editButton) {
    const work = adminWorks.find((item) => item.id === editButton.dataset.editWork);
    if (work) fillWorkForm(work);
  }
  const selectOrderButton = event.target.closest("[data-select-order]");
  if (selectOrderButton) {
    selectAdminOrder(selectOrderButton.dataset.selectOrder);
  }
  const editContentEntry = event.target.closest("[data-edit-content-entry]");
  if (editContentEntry) {
    const entry = adminContentEntries.find((item) => item.id === editContentEntry.dataset.editContentEntry);
    if (entry) fillContentEntryForm(entry);
  }
  const archiveContentEntry = event.target.closest("[data-archive-content-entry]");
  if (archiveContentEntry) {
    const entry = adminContentEntries.find((item) => item.id === archiveContentEntry.dataset.archiveContentEntry);
    if (!entry || entry.contentStatus === "archived") return;
    archiveContentEntry.disabled = true;
    try {
      const result = await requestJson(`/api/admin/content/entries/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: entry.version, contentStatus: "archived" }),
      });
      const archived = { ...result.entry, canRestore: true };
      adminContentEntries[adminContentEntries.findIndex((item) => item.id === archived.id)] = archived;
      renderContentEntries();
      if (selectedContentEntryId === archived.id) fillContentEntryForm(archived);
      setAdminStatus(t("contentSaved"));
    } catch (error) {
      setAdminStatus(error.status === 409 ? t("adminVersionConflict") : requestFailureText(error), true);
      if (error.status === 409) await loadAdminContent();
      else archiveContentEntry.disabled = false;
    }
  }
});

byId("languageToggle").addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  saveState();
  renderStatusOptions();
  renderLegacyPanels();
  renderAdminWorks();
  renderAdminOrders();
  renderEmailOutbox();
  renderContentEntries();
  fillContentProfileForm();
  renderMediaIntegrity();
  const selectedEntry = adminContentEntries.find((entry) => entry.id === selectedContentEntryId);
  if (selectedEntry) fillContentEntryForm(selectedEntry, { scroll: false });
});

byId("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("is-open");
});

applyLanguage();
renderStatusOptions();
renderLegacyPanels();
resetContentEntryForm();
loadAdminWorks();
renderEmailOutbox();
