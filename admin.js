// ===== admin.js - 管理后台专用 =====
// 依赖 common.js 提供：state, translations, t(), byId(), saveState(), applyLanguage(),
// readImage(), selectedImageData, selectedPortraitData, ADMIN_PASSWORD,
// isAdminUnlocked(), unlockAdmin(), showAdminModal(), hideAdminModal(), asset()

// ===== 1. 下拉选项渲染 =====

function renderStatusOptions() {
  byId("status").innerHTML = ["available", "sold", "draft", "private"]
    .map((status) => `<option value="${status}">${t(status)}</option>`)
    .join("");
  byId("personRole").innerHTML = ["administrator", "editor", "viewer"]
    .map((role) => `<option value="${role}">${t(role)}</option>`)
    .join("");
}

// ===== 2. 作品管理列表 =====

function renderAdminWorks() {
  byId("workAdminList").innerHTML =
    state.works
      .map(
        (work) => `
        <div class="admin-item">
          <img src="${work.image}" alt="${work.titleZh}" />
          <div>
            <h3>${work.titleZh}</h3>
            <p>${work.category || "-"} · ${work.size || "-"} · ${work.year || "-"} · ${t(work.status)}</p>
          </div>
          <div class="item-actions">
            <button class="icon-button" type="button" title="${t("edit")}" data-edit-work="${work.id}">✎</button>
            <button class="icon-button" type="button" title="${t("remove")}" data-remove-work="${work.id}">×</button>
          </div>
        </div>`
      )
      .join("") || `<div class="empty-state">${t("empty")}</div>`;
}

// ===== 3. 人员列表 =====

function renderPeople() {
  byId("peopleList").innerHTML = state.people
    .map(
      (person) => `
      <div class="admin-item">
        <div></div>
        <div><h3>${person.name}</h3><p>${t(person.role)}</p></div>
        <div class="item-actions">
          <button class="icon-button" type="button" title="${t("remove")}" data-remove-person="${person.id}">×</button>
        </div>
      </div>`
    )
    .join("");
}

// ===== 4. 咨询记录列表 =====

function renderInquiries() {
  byId("inquiryList").innerHTML =
    state.inquiries
      .map((inquiry) => {
        const work = state.works.find((item) => item.id === inquiry.workId);
        return `
          <div class="admin-item">
            <div></div>
            <div>
              <h3>${work ? work.titleZh : inquiry.workId}</h3>
              <p>${inquiry.name} · ${inquiry.contact}</p>
              <p>${inquiry.message || ""}</p>
            </div>
            <div>${inquiry.date}</div>
          </div>`;
      })
      .join("") || `<div class="empty-state">${t("noInquiries")}</div>`;
}

// ===== 5. 重置作品表单 =====

function resetWorkForm() {
  byId("workForm").reset();
  byId("workId").value = "";
  selectedImageData = "";
}

// ===== 6. 填充作品编辑表单 =====

function fillWorkForm(work) {
  byId("workId").value = work.id;
  byId("titleZh").value = work.titleZh;
  byId("titleEn").value = work.titleEn;
  byId("category").value = work.category;
  byId("medium").value = work.medium;
  byId("size").value = work.size;
  byId("year").value = work.year;
  byId("price").value = work.price;
  byId("status").value = work.status;
  byId("hidePrice").checked = work.hidePrice;
  byId("descriptionZh").value = work.descriptionZh;
  byId("descriptionEn").value = work.descriptionEn;
  selectedImageData = "";
  location.hash = "admin";
}

// ===== 7. 填充艺术家资料表单 =====

function fillArtistForm() {
  byId("artistNameInput").value = state.artist.name;
  byId("artistBioZh").value = state.artist.bioZh;
  byId("artistBioEn").value = state.artist.bioEn;
  selectedPortraitData = "";
}

// ===== 8. renderAll（管理版） =====

function renderAll() {
  applyLanguage();
  renderStatusOptions();
  renderAdminWorks();
  renderPeople();
  renderInquiries();
  fillArtistForm();
}

// ===== 9. 事件监听器 =====

// 管理 tab 切换
document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.classList.remove("is-active"));
    button.classList.add("is-active");
    ["Works", "Artist", "People", "Inquiries"].forEach((name) => {
      byId(`admin${name}`).hidden = button.dataset.adminTab !== name.toLowerCase();
    });
  });
});

// 图片上传
byId("imageUpload").addEventListener("change", (event) => {
  readImage(event.target.files[0], (data) => {
    selectedImageData = data;
  });
});

byId("portraitUpload").addEventListener("change", (event) => {
  readImage(event.target.files[0], (data) => {
    selectedPortraitData = data;
  });
});

// 作品表单提交
byId("workForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const existingId = byId("workId").value;
  const work = {
    id: existingId || `work-${Date.now()}`,
    titleZh: byId("titleZh").value.trim(),
    titleEn: byId("titleEn").value.trim(),
    category: byId("category").value.trim(),
    medium: byId("medium").value.trim(),
    size: byId("size").value.trim(),
    year: byId("year").value.trim(),
    price: byId("price").value.trim(),
    status: byId("status").value,
    hidePrice: byId("hidePrice").checked,
    image: selectedImageData || (state.works.find((item) => item.id === existingId) || {}).image || asset("studio-1.jpg"),
    descriptionZh: byId("descriptionZh").value.trim(),
    descriptionEn: byId("descriptionEn").value.trim(),
  };
  if (existingId) {
    state.works = state.works.map((item) => (item.id === existingId ? work : item));
  } else {
    state.works.unshift(work);
  }
  saveState();
  resetWorkForm();
  renderAll();
});

byId("resetWorkForm").addEventListener("click", resetWorkForm);

// 艺术家表单提交
byId("artistForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.artist.name = byId("artistNameInput").value.trim() || state.artist.name;
  state.artist.bioZh = byId("artistBioZh").value.trim();
  state.artist.bioEn = byId("artistBioEn").value.trim();
  if (selectedPortraitData) state.artist.portrait = selectedPortraitData;
  saveState();
  renderAll();
});

// 人员表单提交
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

// 密码弹窗
byId("adminLoginBtn").addEventListener("click", () => {
  const pwd = byId("adminPasswordInput").value;
  if (pwd === ADMIN_PASSWORD) {
    unlockAdmin();
    hideAdminModal();
    renderAll();
    location.hash = "admin";
  } else {
    byId("adminPasswordError").textContent = t("adminWrongPassword");
  }
});

byId("adminCancelBtn").addEventListener("click", () => {
  hideAdminModal();
  location.hash = "#";
});

byId("adminPasswordInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") byId("adminLoginBtn").click();
});

// 语言切换
byId("languageToggle").addEventListener("click", () => {
  state.language = state.language === "zh" ? "en" : "zh";
  saveState();
  renderAll();
});

// 菜单切换
byId("menuToggle").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("is-open");
});

// 全局点击处理：data-edit-work / data-remove-work / data-remove-person
document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-work]");
  if (editButton) {
    const work = state.works.find((item) => item.id === editButton.dataset.editWork);
    if (work) fillWorkForm(work);
  }

  const removeButton = event.target.closest("[data-remove-work]");
  if (removeButton) {
    state.works = state.works.filter((item) => item.id !== removeButton.dataset.removeWork);
    saveState();
    renderAll();
  }

  const removePerson = event.target.closest("[data-remove-person]");
  if (removePerson) {
    state.people = state.people.filter((person) => person.id !== removePerson.dataset.removePerson);
    saveState();
    renderPeople();
  }
});

// ===== 10. 管理导航链接拦截 & hashchange 拦截 =====

// 拦截管理入口链接
const adminLink = document.querySelector('[href="#admin"]');
if (adminLink) {
  adminLink.addEventListener("click", (event) => {
    if (!isAdminUnlocked()) {
      event.preventDefault();
      showAdminModal();
    }
  });
}

// 拦截 hash 变化（密码保护）
window.addEventListener("hashchange", () => {
  if (location.hash === "#admin" && !isAdminUnlocked()) {
    location.hash = "#";
    showAdminModal();
  }
});

// ===== 页面初始化：先弹密码框 =====
(function initAdmin() {
  if (isAdminUnlocked()) {
    renderAll();
  } else {
    showAdminModal();
  }
})();
