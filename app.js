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
  const gridSlots = 12;
  let html = "";
  const firstWork = works.length > 0 ? works[0] : null;
  for (let i = 0; i < gridSlots; i++) {
    if (i === 11) {
      html += '<article class="art-card more-card"><a href="works.html" class="card-link" style="position:relative;overflow:hidden;">' + (firstWork ? '<img src="' + firstWork.image + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.35);" />' : '') + '<div class="more-content"><span class="more-icon">+</span><span>' + t("moreWorks") + '</span></div></a></article>';
      continue;
    }
    const work = works[i];
    if (!work) { html += '<div class="art-card empty-slot"></div>'; continue; }
    const title = localText(work, "titleZh", "titleEn");
    const price = work.hidePrice || !work.price ? t("priceOnRequest") : work.price;
    html += '<article class="art-card" tabindex="0" data-work-id="' + work.id + '"><a href="works/' + work.id + '.html" class="card-link"><figure><img src="' + work.image + '" alt="' + title + '" /></figure><div class="art-card-body"><h3>' + title + '<span class="badge">' + t(work.status) + '</span></h3><div class="meta-line">' + work.medium + ' · ' + work.size + ' · ' + work.year + '</div><div class="price-line">' + price + '</div></div></a></article>';
  }
  byId("artGrid").innerHTML = html;
}
function renderDetail(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) return;
  byId("workDetail").hidden = false;
  byId("detailLayout").innerHTML = `
    <div class="detail-image"><img src="${work.image}" alt="${localText(work, "titleZh", "titleEn")}" /></div>
    <div class="detail-copy">
      <h2>${localText(work, "titleZh", "titleEn")}</h2>
      <dl>
        <dt>${t("category")}</dt><dd>${work.category || "-"}</dd>
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
  byId("workDetail").scrollIntoView({ behavior: "smooth" });
}

function renderArtist() {
  document.querySelector(".artist-portrait img").src = state.artist.portrait;
  document.querySelector(".artist-portrait img").alt = state.artist.name;
  document.querySelector('[data-i18n="artistName"]').textContent = state.language === "zh" ? state.artist.name : "You Xianglong";
  document.querySelector('[data-i18n="artistBio"]').textContent =
    state.language === "zh" ? state.artist.bioZh : state.artist.bioEn;
  byId("timeline").innerHTML = state.timeline
    .map(
      (item) => `
      <div class="timeline-item">
        <div class="timeline-year">${item.year}</div>
        <div>${state.language === "zh" ? item.zh : item.en}</div>
      </div>`
    )
    .join("");
}

function renderInquirySelect() {
  byId("inquiryWork").innerHTML = visibleWorks()
    .map((work) => `<option value="${work.id}">${localText(work, "titleZh", "titleEn")}</option>`)
    .join("");
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
  if (card) renderDetail(card.dataset.workId);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const card = event.target.closest("[data-work-id]");
  if (card) renderDetail(card.dataset.workId);
});

byId("languageToggle").addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  saveState();
  renderAll();
});

byId("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("is-open");
});

byId("closeDetail").addEventListener("click", () => {
  byId("workDetail").hidden = true;
  byId("gallery").scrollIntoView({ behavior: "smooth" });
});

byId("searchInput").addEventListener("input", renderGallery);
byId("categoryFilter").addEventListener("change", renderGallery);
byId("availabilityFilter").addEventListener("change", renderGallery);

byId("inquiryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.inquiries.unshift({
    id: `inquiry-${Date.now()}`,
    workId: byId("inquiryWork").value,
    name: byId("inquiryName").value.trim(),
    contact: byId("inquiryContact").value.trim(),
    message: byId("inquiryMessage").value.trim(),
    date: new Date().toLocaleDateString(),
  });
  saveState();
  byId("formNote").textContent = t("inquirySaved");
  event.target.reset();
});

// 首页轮播
const heroSlides = [
  "assets/jiangnan-2024.jpg",
  "assets/jiangnan-series-6.jpg",
  "assets/flower-2025.jpg",
  "assets/grass-2024.jpg",
  "assets/ta-series-5.jpg",
];
let heroIndex = 0;
let heroTimer = null;

function renderHeroDots() {
  byId("heroDots").innerHTML = heroSlides
    .map((_, i) => `<button class="${i === heroIndex ? "is-active" : ""}" data-slide="${i}"></button>`)
    .join("");
}

function goToSlide(index) {
  heroIndex = index;
  const img = byId("heroImage");
  img.style.opacity = 0;
  setTimeout(() => {
    img.src = heroSlides[heroIndex];
    img.style.opacity = 0.82;
  }, 400);
  renderHeroDots();
}

function startSlideshow() {
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

// 管理入口：弹密码 → 正确才跳转
byId("adminEntry").addEventListener("click", (e) => {
  e.preventDefault();
  showAdminModal();
});

byId("adminLoginBtn").addEventListener("click", () => {
  const pwd = byId("adminPasswordInput").value;
  if (pwd === ADMIN_PASSWORD) {
    unlockAdmin();
    hideAdminModal();
    location.href = "admin.html";
  } else {
    byId("adminPasswordError").textContent = t("adminWrongPassword");
  }
});

byId("adminCancelBtn").addEventListener("click", () => { hideAdminModal(); });
byId("adminPasswordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") byId("adminLoginBtn").click();
});

renderAll();
