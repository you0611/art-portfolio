// ===== admin.js - server-backed artwork management =====
// Artist, people, and inquiry panels intentionally remain legacy local features.

let adminWorks = [];
let adminOrders = [];
let adminEmails = [];
let emailMode = "local-fake";
let emailOutboxError = "";
let selectedOrderId = "";
let selectedPortraitData = "";
const REQUEST_TIMEOUT_MS = 15000;

function setAdminStatus(message, isError = false) {
  const node = byId("adminStatus");
  node.textContent = message;
  node.style.color = isError ? "var(--accent)" : "";
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  let body = null;
  try {
    response = await fetch(path, { ...options, headers, cache: "no-store", signal: controller.signal });
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

function textElement(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text ?? "";
  if (className) element.className = className;
  return element;
}

function renderStatusOptions() {
  byId("status").replaceChildren(
    ...["available", "sold", "not_for_sale"].map((value) => new Option(t(value), value)),
  );
  byId("contentStatus").replaceChildren(
    ...["draft", "published", "archived"].map((value) => new Option(t(value), value)),
  );
  byId("personRole").replaceChildren(
    ...["administrator", "editor", "viewer"].map((value) => new Option(t(value), value)),
  );
}

function renderAdminWorks() {
  const list = byId("workAdminList");
  list.replaceChildren();
  if (!adminWorks.length) {
    list.append(textElement("div", t("empty"), "empty-state"));
    return;
  }
  for (const work of adminWorks) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const image = document.createElement("img");
    image.src = work.image;
    image.alt = work.titleZh;
    const copy = document.createElement("div");
    copy.append(
      textElement("h3", work.titleZh),
      textElement(
        "p",
        `${work.category || "-"} · ${work.dimensions || "-"} · ${work.year || "-"} · ${t(work.saleStatus)}`,
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
      `${t(offer.proposedBy === "admin" ? "adminOffer" : "customerOffer")} · ${offer.amountMinor} ${offer.currency}`,
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
        `${t(order.latestOffer.proposedBy === "admin" ? "adminOffer" : "customerOffer")} · ${order.latestOffer.amountMinor} ${order.latestOffer.currency} · ${t(order.latestOffer.status)}`,
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

function renderPeople() {
  const list = byId("peopleList");
  list.replaceChildren();
  for (const person of state.people) {
    const item = document.createElement("div");
    item.className = "admin-item";
    const copy = document.createElement("div");
    copy.append(textElement("h3", person.name), textElement("p", t(person.role)));
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const remove = textElement("button", t("remove"), "icon-button");
    remove.type = "button";
    remove.dataset.removePerson = person.id;
    actions.append(remove);
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

function fillArtistForm() {
  byId("artistNameInput").value = state.artist.name;
  byId("artistBioZh").value = state.artist.bioZh;
  byId("artistBioEn").value = state.artist.bioEn;
  selectedPortraitData = "";
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
  byId("price").value = work.priceMinor ?? "";
  byId("currency").value = work.currency;
  byId("status").value = work.saleStatus;
  byId("contentStatus").value = work.contentStatus;
  byId("hidePrice").checked = work.priceVisibility === "private_quote";
  byId("negotiationEnabled").checked = work.negotiationEnabled;
  byId("image").value = work.image;
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
    priceMinor: price === "" ? null : Number(price),
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
  renderPeople();
  renderInquiries();
  fillArtistForm();
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
        amountMinor: Number(byId("orderOfferAmount").value),
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

byId("artistForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.artist.name = byId("artistNameInput").value.trim() || state.artist.name;
  state.artist.bioZh = byId("artistBioZh").value.trim();
  state.artist.bioEn = byId("artistBioEn").value.trim();
  if (selectedPortraitData) state.artist.portrait = selectedPortraitData;
  saveState();
  renderLegacyPanels();
});

byId("portraitUpload").addEventListener("change", (event) => {
  readImage(event.target.files[0], (data) => {
    selectedPortraitData = data;
  });
});

byId("peopleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.people.push({
    id: `person-${Date.now()}`,
    name: byId("personName").value.trim(),
    role: byId("personRole").value,
  });
  saveState();
  event.target.reset();
  renderPeople();
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-work]");
  if (editButton) {
    const work = adminWorks.find((item) => item.id === editButton.dataset.editWork);
    if (work) fillWorkForm(work);
  }
  const selectOrderButton = event.target.closest("[data-select-order]");
  if (selectOrderButton) {
    selectAdminOrder(selectOrderButton.dataset.selectOrder);
  }
  const removePerson = event.target.closest("[data-remove-person]");
  if (removePerson) {
    state.people = state.people.filter((person) => person.id !== removePerson.dataset.removePerson);
    saveState();
    renderPeople();
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
});

byId("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("is-open");
});

applyLanguage();
renderStatusOptions();
renderLegacyPanels();
loadAdminWorks();
renderEmailOutbox();
