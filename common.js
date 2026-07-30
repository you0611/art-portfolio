const asset = (name) => `assets/${name}`;

const translations = {
  zh: {
    brandName: "游祥龙艺术工作室",
    brandSub: "油画 · 风景 · 人物",
    navGallery: "作品",
    navArtist: "艺术家",
    navContact: "收藏咨询",
    navAdmin: "管理",
    heroKicker: "Contemporary Chinese Oil Painting",
    heroTitle: "游祥龙",
    heroText: "在江南水色与人物叙事之间，记录时间、乡土与人的精神轮廓。",
    viewWorks: "浏览作品",
    meetArtist: "了解艺术家",
    galleryKicker: "Selected Works",
    galleryTitle: "作品收藏",
    searchPlaceholder: "搜索标题、系列、年份",
    allWorks: "全部作品",
    availableOnly: "可咨询",
    soldOnly: "已收藏",
    backToWorks: "返回作品",
    artistKicker: "Artist",
    artistName: "游祥龙",
    artistBio:
      "中国美术家协会会员，中国民族画院聘用画家、研究员，广东省美术家协会会员。作品曾在国展中屡次获奖，并被贵州美术馆、江苏美术馆、北京民族文化宫、尹山湖美术馆、大芬美术馆、李自健美术馆等收藏。",
    contactKicker: "Acquisition Inquiry",
    contactTitle: "作品收藏咨询",
    contactText:
      "你可以留下想咨询的作品、联系方式和备注。当前本地版会把询价记录保存在后台，正式上线后可接入邮箱、微信或表单服务。",
    formWork: "咨询作品",
    formName: "姓名",
    formContact: "联系方式",
    formMessage: "留言",
    submitInquiry: "提交咨询",
    adminKicker: "Management",
    adminTitle: "网站管理",
    tabWorks: "作品管理",
    tabArtist: "艺术家资料",
    tabPeople: "人员",
    tabInquiries: "咨询记录",
    titleZh: "中文标题",
    titleEn: "英文标题",
    category: "系列/类别",
    medium: "媒介",
    size: "尺寸",
    year: "年份",
    price: "价格",
    status: "状态",
    hidePrice: "不公开价格",
    imageUpload: "上传作品图片",
    descriptionZh: "中文简介",
    descriptionEn: "英文简介",
    saveWork: "保存作品",
    newWork: "新增作品",
    artistNameLabel: "艺术家姓名",
    artistBioZh: "中文简介",
    artistBioEn: "英文简介",
    portraitUpload: "上传肖像",
    saveArtist: "保存艺术家资料",
    personName: "人员姓名",
    personRole: "角色",
    addPerson: "添加人员",
    footerText: "游祥龙艺术工作室 · 本地预览版",
    footerAdmin: "进入管理",
    available: "可咨询",
    sold: "已收藏",
    draft: "草稿",
    private: "不公开",
    priceOnRequest: "价格请咨询",
    inquiry: "咨询收藏",
    edit: "编辑",
    remove: "删除",
    empty: "暂无内容",
    saved: "已保存",
    inquirySaved: "咨询已保存，可在后台查看。",
    administrator: "管理员",
    editor: "编辑",
    viewer: "查看者",
    noInquiries: "还没有咨询记录。",
    adminLogin: "管理后台",
    adminLoginHint: "请输入密码进入管理后台。",
    adminLoginBtn: "进入",
    adminCancelBtn: "取消",
    adminWrongPassword: "密码错误，请重试。",
    honorsTitle: "展览荣誉",
    contactPhone: "电话",
    contactAddress: "画廊地址",
    moreWorks: "了解更多",
  },
  en: {
    brandName: "You Xianglong Art Studio",
    brandSub: "Oil Painting · Landscape · Figure",
    navGallery: "Works",
    navArtist: "Artist",
    navContact: "Inquiry",
    navAdmin: "Admin",
    heroKicker: "Contemporary Chinese Oil Painting",
    heroTitle: "You Xianglong",
    heroText: "Between Jiangnan waterscapes and human narratives, the paintings trace memory, place, and spirit.",
    viewWorks: "View Works",
    meetArtist: "Meet the Artist",
    galleryKicker: "Selected Works",
    galleryTitle: "Collection",
    searchPlaceholder: "Search title, series, year",
    allWorks: "All works",
    availableOnly: "Available",
    soldOnly: "Collected",
    backToWorks: "Back to works",
    artistKicker: "Artist",
    artistName: "You Xianglong",
    artistBio:
      "You Xianglong is a member of the China Artists Association, a painter and researcher of the China National Art Institute, and a member of the Guangdong Artists Association. His works have received national exhibition awards and entered public and private collections.",
    contactKicker: "Acquisition Inquiry",
    contactTitle: "Acquisition Inquiry",
    contactText:
      "Leave the work, contact information, and notes you would like to discuss. This local version stores inquiries in the admin area; the online version can connect email, WeChat, or a form service.",
    formWork: "Work",
    formName: "Name",
    formContact: "Contact",
    formMessage: "Message",
    submitInquiry: "Submit Inquiry",
    adminKicker: "Management",
    adminTitle: "Site Admin",
    tabWorks: "Works",
    tabArtist: "Artist",
    tabPeople: "People",
    tabInquiries: "Inquiries",
    titleZh: "Chinese title",
    titleEn: "English title",
    category: "Series / Category",
    medium: "Medium",
    size: "Size",
    year: "Year",
    price: "Price",
    status: "Status",
    hidePrice: "Hide price",
    imageUpload: "Upload image",
    descriptionZh: "Chinese description",
    descriptionEn: "English description",
    saveWork: "Save work",
    newWork: "New work",
    artistNameLabel: "Artist name",
    artistBioZh: "Chinese bio",
    artistBioEn: "English bio",
    portraitUpload: "Upload portrait",
    saveArtist: "Save artist profile",
    personName: "Name",
    personRole: "Role",
    addPerson: "Add person",
    footerText: "You Xianglong Art Studio · Local preview",
    footerAdmin: "Open admin",
    available: "Available",
    sold: "Collected",
    draft: "Draft",
    private: "Private",
    priceOnRequest: "Price on request",
    inquiry: "Inquire",
    edit: "Edit",
    remove: "Delete",
    empty: "Nothing here yet",
    saved: "Saved",
    inquirySaved: "Inquiry saved. You can view it in Admin.",
    administrator: "Administrator",
    editor: "Editor",
    viewer: "Viewer",
    noInquiries: "No inquiries yet.",
    adminLogin: "Admin Login",
    adminLoginHint: "Enter the password to access the admin panel.",
    adminLoginBtn: "Enter",
    adminCancelBtn: "Cancel",
    adminWrongPassword: "Wrong password. Please try again.",
    honorsTitle: "Exhibition Honors",
    contactPhone: "Phone",
    contactAddress: "Gallery Address",
    moreWorks: "More Works",
  },
};

const starterState = {
  language: "zh",
  artist: {
    name: "游祥龙",
    portrait: asset("artist-portrait.jpg"),
    bioZh:
      "中国美术家协会会员，中国民族画院聘用画家、研究员，广东省美术家协会会员。作品曾在国展中屡次获奖，并被贵州美术馆、江苏美术馆、北京民族文化宫、尹山湖美术馆、大芬美术馆、李自健美术馆等收藏。作品《踩芦笙》2020年获百家金陵收藏奖，《江南行》作为江苏交通版权卡出版发行。",
    bioEn:
      "You Xianglong is a member of the China Artists Association, a painter and researcher of the China National Art Institute, and a member of the Guangdong Artists Association. His oil paintings have been selected for national exhibitions, received awards, and entered institutional collections.",
  },
  timeline: [
    { year: "2026", zh: "作品《她系列八》入选中国美协新文艺群体美术作品展。", en: "She Series No. 8 selected for the China Artists Association New Literary & Art Groups Exhibition." },
    { year: "2025", zh: "作品《她系列八》参加\"东方之光\"中韩艺术交流展（韩国首尔）。", en: "She Series No. 8 shown in 'Light of the East' China-Korea Art Exchange (Seoul)." },
    { year: "2025", zh: "作品《她系列六》入选第四届深圳大芬国际油画双年展。", en: "She Series VI selected for the 4th Shenzhen Dafen International Oil Painting Biennale." },
    { year: "2024", zh: "作品《她系列七》入选\"红岩清风\"廉洁文化美术作品展。", en: "She Series VII selected for the 'Red Rock Breeze' Clean Culture Art Exhibition." },
    { year: "2024", zh: "作品《喀什大巴扎三》入选陆海之约——第十二届中国西部大地情中国画、油画作品展。", en: "Kashgar Grand Bazaar III selected for the 12th China Western Landscape Art Exhibition." },
    { year: "2023", zh: "作品《泊 NO.6》《泊 NO.8》入选\"得境取象\"第三届东亿中国油画作品展。", en: "Mooring No.6 & No.8 selected for the 3rd Dongyi China Oil Painting Exhibition." },
    { year: "2023", zh: "作品《乡情系列八》入选第二届\"华夏意韵——中国油画精品展\"。", en: "Nostalgia Series VIII selected for the 2nd Huaxia Yiyun China Oil Painting Exhibition." },
    { year: "2022", zh: "作品《高二那年》入选\"时代·肖像\"2022中国油画作品展。", en: "That Year in Grade Two selected for the 2022 Era·Portrait China Oil Painting Exhibition." },
    { year: "2022", zh: "作品《岁月静好》入选\"时代颂歌\"2022中国百家金陵油画展，入会资格。", en: "Peaceful Times selected for the 2022 Era Ode China Baijia Jinling Exhibition (membership qualification)." },
    { year: "2022", zh: "作品《笙声不息二》入选2022第三届深圳大芬国际油画双年展（馆藏）。", en: "Lusheng Sound Never Ends II selected for the 3rd Shenzhen Dafen International Oil Painting Biennale (collection)." },
    { year: "2022", zh: "作品《笙声不息》入选2022全国少数民族美术作品展，入会资格（馆藏）。", en: "Lusheng Sound Never Ends selected for the 2022 National Minority Art Exhibition (membership qualification, collection)." },
    { year: "2022", zh: "作品《她系列五》入选\"悲鸿风度\"首届油画双年展，入会资格。", en: "She Series V selected for the 1st Beihong Grace Oil Painting Biennale (membership qualification)." },
    { year: "2022", zh: "作品《红》入选\"心境物语——首届中国写意油画静物专题研究展\"（馆藏）。", en: "Red selected for the 1st Chinese Xieyi Oil Painting Still Life Exhibition (collection)." },
    { year: "2021", zh: "作品《她系列三》入选\"江南如画中国油画作品展2021\"。", en: "She Series III selected for the 2021 Jiangnan as in Painting China Oil Painting Exhibition." },
    { year: "2021", zh: "作品《她系列二》入选首届\"倪云林\"全国美术作品展（中国画、油画）。", en: "She Series II selected for the 1st Ni Yunlin National Art Exhibition." },
    { year: "2021", zh: "作品《她系列一》入选第五届\"时代之光\"中国油画展，入会资格。", en: "She Series I selected for the 5th Light of the Era China Oil Painting Exhibition (membership qualification)." },
    { year: "2020", zh: "作品《路上》入选\"第九届全国（大芬）青年油画作品展\"。", en: "On the Road selected for the 9th National (Dafen) Youth Oil Painting Exhibition." },
    { year: "2020", zh: "作品《踩芦笙》入选\"百年梦圆2020\"中国百家金陵油画作品展，获收藏奖（馆藏）。", en: "Cai Lusheng selected for the 2020 China Baijia Jinling Oil Painting Exhibition, Collection Award (collection)." },
    { year: "2019", zh: "作品《江南行》入选\"诗意大运河\"2019年全国油画作品展，入会资格（馆藏）。", en: "Journey to Jiangnan selected for the 2019 Poetic Grand Canal National Oil Painting Exhibition (membership qualification, collection)." },
    { year: "2019", zh: "作品《归去来兮》入选\"得境取象\"第二届东亿中国油画作品展。", en: "Return selected for the 2nd Dongyi China Oil Painting Exhibition." },
    { year: "2019", zh: "作品《乡情》入选徐悲鸿画院庆祝新中国成立70周年油画展。", en: "Nostalgia selected for the Xu Beihong Art Academy 70th Anniversary Oil Painting Exhibition." },
    { year: "2016", zh: "作品《传承》入选\"同心筑梦\"第二届中国民族美术双年展，入会资格（馆藏）。", en: "Inheritance selected for the 2nd China National Art Biennale (membership qualification, collection)." },
  ],
  works: [
    {
      id: "guiquilaixi", titleZh: "归去来兮", titleEn: "Return",
      category: "风景", medium: "布面油画", size: "90 × 135 cm",
      year: "2019", price: "", hidePrice: true, status: "available",
      image: asset("guiquilaixi.jpg"),
      descriptionZh: "入选\"得境取象\"第二届东亿中国油画作品展。",
      descriptionEn: "Selected for the 2nd Dongyi China Oil Painting Exhibition.",
    },
    {
      id: "shengsheng-2", titleZh: "笙声不息（二）", titleEn: "Lusheng Sound Never Ends II",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "available",
      image: asset("shengsheng-2.jpg"),
      descriptionZh: "2022年入选第三届深圳大芬国际油画双年展（馆藏）。",
      descriptionEn: "Selected for the 3rd Shenzhen Dafen International Oil Painting Biennale.",
    },
    {
      id: "shengsheng-3", titleZh: "笙声不息（三）", titleEn: "Lusheng Sound Never Ends III",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "available",
      image: asset("shengsheng-3.jpg"),
      descriptionZh: "笙声不息系列第三幅，以芦笙舞展现民族文化生命力。",
      descriptionEn: "Third in the Lusheng series, celebrating ethnic cultural vitality.",
    },
    {
      id: "chengzhongcun", titleZh: "城中村——红色记忆", titleEn: "Urban Village – Red Memory",
      category: "城市记忆", medium: "布面油画", size: "130 × 160 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("chengzhongcun.jpg"),
      descriptionZh: "记录城市化进程中的空间记忆与色彩张力。",
      descriptionEn: "Spatial memory and color tension in urbanization.",
    },
    {
      id: "banyan", titleZh: "池塘边的大榕树", titleEn: "Banyan by the Pond",
      category: "风景", medium: "布面油画", size: "122 × 155 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("banyan.jpg"),
      descriptionZh: "描绘南方乡间的静谧与生命力。",
      descriptionEn: "Serenity and vitality of the southern countryside.",
    },
    {
      id: "on-the-road", titleZh: "路上", titleEn: "On the Road",
      category: "人物与叙事", medium: "布面油画", size: "180 × 130 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("on-the-road.jpg"),
      descriptionZh: "入选第九届全国（大芬）青年油画作品展。",
      descriptionEn: "Selected for the 9th National Youth Oil Painting Exhibition.",
    },
    {
      id: "she-series-1", titleZh: "她系列（一）", titleEn: "She Series I",
      category: "她系列", medium: "布面油画", size: "150 × 120 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("she-series-1.jpg"),
      descriptionZh: "2021年入选第五届「时代之光」中国油画展，入会资格。",
      descriptionEn: "Selected for the 5th Light of the Era China Oil Painting Exhibition.",
    },
    {
      id: "she-series-2", titleZh: "她系列（二）", titleEn: "She Series II",
      category: "她系列", medium: "布面油画", size: "120 × 150 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("she-series-2.jpg"),
      descriptionZh: "2021年入选首届「倪云林」全国美术作品展。",
      descriptionEn: "Selected for the 1st Ni Yunlin National Art Exhibition.",
    },
    {
      id: "she-series-3", titleZh: "她系列（三）", titleEn: "She Series III",
      category: "她系列", medium: "布面油画", size: "150 × 120 cm",
      year: "2021", price: "", hidePrice: true, status: "available",
      image: asset("she-series-3.jpg"),
      descriptionZh: "2021年入选「江南如画」中国油画作品展。",
      descriptionEn: "Selected for the 2021 Jiangnan as in Painting Exhibition.",
    },
    {
      id: "shengsheng-1", titleZh: "笙声不息（一）", titleEn: "Lusheng Sound Never Ends I",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "sold",
      image: asset("shengsheng-1.jpg"),
      descriptionZh: "2022年入选全国少数民族美术作品展，馆藏于北京民族文化宫。",
      descriptionEn: "Selected for the 2022 National Minority Art Exhibition.",
    },
    {
      id: "ta-series-5", titleZh: "她系列五", titleEn: "She Series V",
      category: "她系列", medium: "布面油画", size: "160 × 130 cm",
      year: "2021", price: "", hidePrice: true, status: "available",
      image: asset("ta-series-5.jpg"),
      descriptionZh: "2022年入选\"悲鸿风度\"首届油画双年展。",
      descriptionEn: "Selected for the 1st Beihong Grace Oil Painting Biennale.",
    },
    {
      id: "jiangnan-2024", titleZh: "江南", titleEn: "Jiangnan",
      category: "江南系列", medium: "布面油画", size: "140 × 160 cm",
      year: "2024", price: "", hidePrice: true, status: "available",
      image: asset("jiangnan-2024.jpg"),
      descriptionZh: "以江南水乡的湿润光色为线索。",
      descriptionEn: "A Jiangnan waterscape of humid light and quiet rhythm.",
    },
    {
      id: "jiangnan-series-6", titleZh: "江南系列六", titleEn: "Jiangnan Series VI",
      category: "江南系列", medium: "布面油画", size: "120 × 120 cm",
      year: "2025", price: "", hidePrice: true, status: "available",
      image: asset("jiangnan-series-6.jpg"),
      descriptionZh: "方形构图中的江南诗性秩序。",
      descriptionEn: "A square-format Jiangnan poetic order.",
    },
    {
      id: "grass-2024", titleZh: "小草", titleEn: "Grass",
      category: "人物与叙事", medium: "布面油画", size: "120 × 120 cm",
      year: "2024", price: "", hidePrice: true, status: "available",
      image: asset("grass-2024.jpg"),
      descriptionZh: "关注普通生命的韧性。",
      descriptionEn: "Resilience of ordinary life.",
    },
    {
      id: "flower-2025", titleZh: "花非花", titleEn: "Flower, Not Flower",
      category: "人物与叙事", medium: "布面油画", size: "120 × 120 cm",
      year: "2025", price: "", hidePrice: true, status: "available",
      image: asset("flower-2025.jpg"),
      descriptionZh: "在具象与意象之间展开。",
      descriptionEn: "Between figuration and suggestion.",
    },
    {
      id: "jiangnan-trip", titleZh: "江南行", titleEn: "Journey to Jiangnan",
      category: "江南系列", medium: "布面油画", size: "130 × 160 cm",
      year: "2019", price: "", hidePrice: true, status: "sold",
      image: asset("jiangnan-trip.jpg"),
      descriptionZh: "入选\"诗意大运河\"2019年全国油画作品展。",
      descriptionEn: "Selected for the 2019 Poetic Grand Canal Exhibition.",
    },
    {
      id: "cai-lusheng", titleZh: "踩芦笙", titleEn: "Cai Lusheng",
      category: "民族题材", medium: "布面油画", size: "160 × 130 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("cai-lusheng.jpg"),
      descriptionZh: "入选\"百年梦圆2020\"中国百家金陵油画作品展并获收藏奖。",
      descriptionEn: "Selected for the 2020 Baijia Jinling Exhibition, Collection Award.",
    },
  ],
  people: [
    { id: "p-admin", name: "站点管理员", role: "administrator" },
    { id: "p-editor", name: "作品编辑", role: "editor" },
  ],
  inquiries: [],
};

const DATA_VERSION = 2;
const clone = typeof structuredClone === "function" ? structuredClone : function(obj) { return JSON.parse(JSON.stringify(obj)); };

function loadState() {
  const saved = localStorage.getItem("yx-site-v2");
  const ver = localStorage.getItem("yx-ver");
  if (!saved || ver != DATA_VERSION) {
    localStorage.setItem("yx-ver", DATA_VERSION);
    return clone(starterState);
  }
  try {
    return { ...clone(starterState), ...JSON.parse(saved) };
  } catch {
    return clone(starterState);
  }
}

let state = loadState();
let selectedImageData = "";
let selectedPortraitData = "";

const ADMIN_PASSWORD = "you19790214";

function isAdminUnlocked() {
  return sessionStorage.getItem("admin-unlocked") === "true";
}

function unlockAdmin() {
  sessionStorage.setItem("admin-unlocked", "true");
}

function showAdminModal() {
  byId("adminPasswordInput").value = "";
  byId("adminPasswordError").textContent = "";
  byId("adminModal").hidden = false;
  byId("adminPasswordInput").focus();
}

function hideAdminModal() {
  byId("adminModal").hidden = true;
}
function saveState() {
  localStorage.setItem("yx-site-v2", JSON.stringify(state));
}

function t(key) {
  return translations[state.language][key] || translations.zh[key] || key;
}

function byId(id) {
  return document.getElementById(id);
}

function localText(item, zhKey, enKey) {
  return state.language === "zh" ? item[zhKey] || item[enKey] : item[enKey] || item[zhKey];
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  byId("languageToggle").textContent = state.language === "zh" ? "EN" : "中文";
}

function visibleWorks() {
  return state.works.filter((work) => work.status !== "private" && work.status !== "draft");
}

function readImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}
