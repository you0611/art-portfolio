const INQUIRY_TIMEOUT_MS = 15000;
let inquiryRetry = { signature: "", key: "" };

function renderFilters() {
  const categories = ["all", ...new Set(visibleWorks().map((work) => work.category).filter(Boolean))];
  byId("categoryFilter").innerHTML = categories
    .map((category) => `<option value="${category}">${category === "all" ? t("allWorks") : category}</option>`)
    .join("");
}

function renderGallery() {
  const search = byId("searchInput").value.trim().toLowerCase();
  const category = byId("categoryFilter").value || "all";
  const availability = byId("availabilityFilter").value || "all";
  const works = visibleWorks().filter((work) => {
    const haystack = `${work.titleZh} ${work.titleEn} ${work.category} ${work.year}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory = category === "all" || work.category === category;
    const matchesAvailability = availability === "all" || work.status === availability;
    return matchesSearch && matchesCategory && matchesAvailability;
  });
  if (!works.length) {
    byId("artGrid").innerHTML = `<div class="empty-state">${t("galleryEmpty")}</div>`;
    return;
  }

  let html = "";
  works.slice(0, 8).forEach((work, index) => {
    const title = localText(work, "titleZh", "titleEn");
    const price = work.hidePrice || !work.price ? t("priceOnRequest") : work.price;
    const href = workDetailHref(work.id);
    const dynamicDetail = href.startsWith("gallery.html?");
    html += '<article class="art-card" tabindex="0"' + (dynamicDetail ? ' data-work-id="' + work.id + '"' : '') + '><a href="' + href + '" class="card-link"><figure><img src="' + work.image + '" alt="' + title + '" loading="lazy" decoding="async" /></figure><div class="art-card-body"><div class="art-card-heading"><span class="art-card-order">' + String(index + 1).padStart(2, "0") + '</span><span class="badge">' + t(work.status) + '</span></div><h3>' + title + '</h3><div class="meta-line">' + work.medium + ' · ' + work.size + ' · ' + work.year + '</div><div class="price-line">' + price + '</div></div></a></article>';
  });

  const firstWork = works[0];
  html += '<article class="art-card more-card"><a href="works.html" class="card-link"><img class="more-card-image" src="' + firstWork.image + '" alt="" loading="lazy" decoding="async" /><div class="more-content"><span class="more-icon" aria-hidden="true"></span><span>' + t("moreWorks") + '</span></div></a></article>';
  byId("artGrid").innerHTML = html;
}
let currentDetailId = null;

function renderDetail(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) return;
  currentDetailId = workId;
  byId("workDetail").hidden = false;
  byId("detailLayout").innerHTML = `
    <div class="detail-image"><img src="${work.image}" alt="${localText(work, "titleZh", "titleEn")}" loading="eager" decoding="async" /></div>
    <div class="detail-copy">
      <span class="detail-record">${work.year || ""} · ${work.medium || ""}</span>
      <h2>${localText(work, "titleZh", "titleEn")}</h2>
      <dl>
        ${work.category ? `<dt>${t("category")}</dt><dd>${work.category}</dd>` : ""}
        <dt>${t("medium")}</dt><dd>${work.medium || "-"}</dd>
        <dt>${t("size")}</dt><dd>${work.size || "-"}</dd>
        <dt>${t("year")}</dt><dd>${work.year || "-"}</dd>
        <dt>${t("price")}</dt><dd>${work.hidePrice || !work.price ? t("priceOnRequest") : work.price}</dd>
        <dt>${t("status")}</dt><dd>${t(work.status)}</dd>
      </dl>
      <p>${localText(work, "descriptionZh", "descriptionEn")}</p>
      <a class="primary-button" href="#contact">${t("inquiry")}</a>
    </div>`;
  byId("inquiryWork").value = work.id;
  const target = location.hash === "#contact" ? byId("contact") : byId("workDetail");
  target.scrollIntoView({ behavior: "smooth" });
}

function renderArtist() {
  document.querySelector(".artist-portrait img").src = state.artist.portrait;
  document.querySelector(".artist-portrait img").alt = state.artist.name;
  document.querySelector('[data-i18n="artistName"]').textContent = state.language === "zh" ? state.artist.name : state.artist.nameEn;
  document.querySelector('[data-i18n="artistBio"]').textContent =
    state.language === "zh" ? state.artist.bioZh : state.artist.bioEn;
  const timeline = byId("timeline");
  timeline.replaceChildren();
  for (const item of state.timeline) {
    const row = document.createElement("div");
    row.className = "timeline-item";
    const year = document.createElement("div");
    year.className = "timeline-year";
    year.textContent = item.year;
    const body = document.createElement("div");
    body.textContent = localText(item, "zh", "en");
    row.append(year, body);
    timeline.append(row);
  }
}

function renderInquirySelect() {
  const select = byId("inquiryWork");
  const submitButton = byId("inquiryForm").querySelector('button[type="submit"]');
  const availableWorks = visibleWorks().filter((work) => work.status === "available");
  select.innerHTML = availableWorks.length
    ? availableWorks.map((work) => `<option value="${work.id}">${localText(work, "titleZh", "titleEn")}</option>`).join("")
    : `<option value="">${t("noAvailableWorks")}</option>`;
  select.disabled = !availableWorks.length;
  submitButton.disabled = !availableWorks.length;
}

function renderAll() {
  applyLanguage();
  renderFilters();
  renderGallery();
  renderArtist();
  renderInquirySelect();
}

document.addEventListener("click", (event) => {
  const card = event.target.closest("[data-work-id]");
  if (card) {
    event.preventDefault();
    history.replaceState(null, "", `?work=${encodeURIComponent(card.dataset.workId)}#workDetail`);
    renderDetail(card.dataset.workId);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const card = event.target.closest("[data-work-id]");
  if (card) {
    event.preventDefault();
    history.replaceState(null, "", `?work=${encodeURIComponent(card.dataset.workId)}#workDetail`);
    renderDetail(card.dataset.workId);
  }
});

byId("languageToggle").addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  saveState();
  renderAll();
  if (currentDetailId) renderDetail(currentDetailId);
  goToSlide(heroIndex);
});

byId("menuToggle").addEventListener("click", () => {
  const menu = document.querySelector(".main-nav");
  const isOpen = menu.classList.toggle("is-open");
  byId("menuToggle").setAttribute("aria-expanded", String(isOpen));
});

byId("closeDetail").addEventListener("click", () => {
  byId("workDetail").hidden = true;
  currentDetailId = null;
  history.replaceState(null, "", `${location.pathname}#gallery`);
  byId("gallery").scrollIntoView({ behavior: "smooth" });
});

byId("searchInput").addEventListener("input", renderGallery);
byId("categoryFilter").addEventListener("change", renderGallery);
byId("availabilityFilter").addEventListener("change", renderGallery);

byId("inquiryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const contact = byId("inquiryContact").value.trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : "";
  const payload = {
    artworkId: byId("inquiryWork").value,
    customerName: byId("inquiryName").value.trim(),
    customerEmail: email,
    customerContact: contact,
    preferredLanguage: state.language,
    contactNote: byId("inquiryMessage").value.trim(),
  };
  const signature = JSON.stringify(payload);
  if (inquiryRetry.signature !== signature) {
    inquiryRetry = { signature, key: crypto.randomUUID() };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INQUIRY_TIMEOUT_MS);
  submitButton.disabled = true;
  byId("formNote").textContent = t("inquirySending");
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": inquiryRetry.key,
      },
      cache: "no-store",
      signal: controller.signal,
      body: signature,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message || "Request failed.");
    byId("formNote").textContent = `${t("inquirySaved")}${body.order.reference}`;
    inquiryRetry = { signature: "", key: "" };
    form.reset();
  } catch (error) {
    byId("formNote").textContent = t(error?.name === "AbortError" ? "inquiryTimeout" : "inquiryFailed");
  } finally {
    clearTimeout(timeout);
    submitButton.disabled = false;
  }
});

// 首页轮播
const heroSlides = [
  "jiangnan-2024",
  "jiangnan-series-6",
  "flower-2025",
  "grass-2024",
  "ta-series-5",
];
let heroIndex = 0;
let heroTimer = null;

function renderHeroDots() {
  byId("heroDots").innerHTML = heroSlides
    .map((id, i) => {
      const work = state.works.find((item) => item.id === id);
      return `<button class="${i === heroIndex ? "is-active" : ""}" data-slide="${i}" aria-label="${localText(work, "titleZh", "titleEn")}" aria-current="${i === heroIndex ? "true" : "false"}"><img src="${work.image}" alt="" /></button>`;
    })
    .join("");
}

function goToSlide(index) {
  heroIndex = index;
  const work = state.works.find((item) => item.id === heroSlides[heroIndex]);
  if (!work) return;
  const img = byId("heroImage");
  img.style.opacity = 0;
  setTimeout(() => {
    img.src = work.image;
    img.alt = localText(work, "titleZh", "titleEn");
    img.style.opacity = 1;
    byId("heroCounter").textContent = `${String(heroIndex + 1).padStart(2, "0")} / ${String(heroSlides.length).padStart(2, "0")}`;
    byId("heroWorkTitle").textContent = localText(work, "titleZh", "titleEn");
    byId("heroWorkMeta").textContent = `${work.medium} · ${work.size} · ${work.year}`;
  }, 260);
  renderHeroDots();
}

function startSlideshow() {
  clearInterval(heroTimer);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  heroTimer = setInterval(() => {
    goToSlide((heroIndex + 1) % heroSlides.length);
  }, 5000);
}

byId("heroDots").addEventListener("click", (event) => {
  const dot = event.target.closest("[data-slide]");
  if (!dot) return;
  clearInterval(heroTimer);
  goToSlide(parseInt(dot.dataset.slide));
  startSlideshow();
});

byId("home").addEventListener("mouseenter", () => clearInterval(heroTimer));
byId("home").addEventListener("mouseleave", startSlideshow);

// 管理入口：身份验证由 Cloudflare Access 负责
byId("adminEntry").addEventListener("click", (e) => {
  e.preventDefault();
  location.href = "admin.html";
});

renderAll();
goToSlide(0);
startSlideshow();

Promise.all([loadPublicContent(), loadPublicArtworks()]).then((results) => {
  if (!results.some(Boolean)) return;
  renderAll();
  if (currentDetailId) renderDetail(currentDetailId);
  goToSlide(heroIndex);
});

const requestedWorkId = new URLSearchParams(location.search).get("work");
if (requestedWorkId) renderDetail(requestedWorkId);
