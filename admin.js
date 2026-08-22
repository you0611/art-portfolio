// ===== admin.js - server-backed artwork management =====
// Artist, people, and inquiry panels intentionally remain legacy local features.

let adminWorks = [];
let selectedPortraitData = "";

function setAdminStatus(message, isError = false) {
  const node = byId("adminStatus");
  node.textContent = message;
  node.style.color = isError ? "var(--accent)" : "";
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  const response = await fetch(path, { ...options, headers, cache: "no-store" });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message || "Request failed.");
    error.status = response.status;
    error.code = body?.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return body;
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
  } catch {
    adminWorks = [];
    renderAdminWorks();
    setAdminStatus(t("adminAccessUnavailable"), true);
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
    ["Works", "Artist", "People", "Inquiries"].forEach((name) => {
      byId(`admin${name}`).hidden = button.dataset.adminTab !== name.toLowerCase();
    });
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
      setAdminStatus(t("adminSaveFailed"), true);
    }
  } finally {
    saveButton.disabled = false;
  }
});

byId("resetWorkForm").addEventListener("click", resetWorkForm);
byId("reloadWorks").addEventListener("click", loadAdminWorks);

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
});

byId("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("is-open");
});

applyLanguage();
renderStatusOptions();
renderLegacyPanels();
loadAdminWorks();
