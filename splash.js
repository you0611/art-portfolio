// 迎宾页轮播
const slides = [
  { img: "assets/jiangnan-2024.jpg",      zh: "《江南》· 140×160 cm · 2024",          en: "Jiangnan · 140×160 cm · 2024" },
  { img: "assets/jiangnan-series-6.jpg",  zh: "《江南系列六》· 120×120 cm · 2025",    en: "Jiangnan Series VI · 120×120 cm · 2025" },
  { img: "assets/flower-2025.jpg",        zh: "《花非花》· 120×120 cm · 2025",        en: "Flower, Not Flower · 120×120 cm · 2025" },
  { img: "assets/grass-2024.jpg",         zh: "《小草》· 120×120 cm · 2024",          en: "Grass · 120×120 cm · 2024" },
  { img: "assets/ta-series-5.jpg",        zh: "《她系列五》· 160×130 cm · 2021",      en: "She Series V · 160×130 cm · 2021" },
];

let idx = 0;
let timer = null;
const lang = localStorage.getItem("splash-lang") || "zh";

function t_splash(key) {
  const msgs = {
    enter: { zh: "进入", en: "Enter" },
    kicker: { zh: "游祥龙", en: "You Xianglong" },
    title_zh: { zh: "油画 · 风景 · 人物", en: "Oil Painting · Landscape · Figure" },
    sub: { zh: "当代写意油画 · 中国美术家协会会员", en: "Contemporary Chinese Oil Painting" },
  };
  return msgs[key]?.[lang] || key;
}

function applySplashLang() {
  document.querySelector(".splash-kicker").textContent = t_splash("kicker");
  document.querySelector(".splash-sub").textContent = t_splash("sub");
  document.getElementById("enterBtn").textContent = t_splash("enter");
  document.getElementById("splashLang").textContent = lang === "zh" ? "EN" : "中文";
  updateCaption();
}

function updateCaption() {
  document.getElementById("splashCaption").textContent = slides[idx][lang];
}

function goSlide(i) {
  idx = (i + slides.length) % slides.length;
  const img = document.getElementById("splashImage");
  img.style.opacity = 0;
  setTimeout(() => {
    img.src = slides[idx].img;
    img.style.opacity = 0.82;
  }, 400);
  updateCaption();
  renderDots();
}

function renderDots() {
  document.getElementById("splashDots").innerHTML = slides
    .map((_, i) => `<button class="${i === idx ? "is-active" : ""}" data-si="${i}"></button>`)
    .join("");
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => goSlide(idx + 1), 5000);
}

// 箭头
document.getElementById("splashPrev").addEventListener("click", () => { goSlide(idx - 1); startTimer(); });
document.getElementById("splashNext").addEventListener("click", () => { goSlide(idx + 1); startTimer(); });

// 圆点
document.getElementById("splashDots").addEventListener("click", (e) => {
  const dot = e.target.closest("[data-si]");
  if (!dot) return;
  goSlide(parseInt(dot.dataset.si));
  startTimer();
});

// 语言切换
document.getElementById("splashLang").addEventListener("click", (e) => {
  e.preventDefault();
  const newLang = document.getElementById("splashLang").textContent === "EN" ? "en" : "zh";
  localStorage.setItem("splash-lang", newLang);
  location.reload();
});

applySplashLang();
renderDots();
startTimer();
