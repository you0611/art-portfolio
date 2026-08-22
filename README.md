# 游祥龙艺术工作室网站本地版

打开 `index.html` 即可本地预览网站。

## 当前包含

- 双语切换：中文 / English。
- 作品板块：作品列表、搜索、分类筛选、作品详情。
- 作品详情：标题、媒介、尺寸、年份、价格或"价格请咨询"、状态、简介、收藏咨询入口。
- 艺术家板块：肖像、简介、展览时间线。
- 收藏咨询：本地保存咨询记录，可在管理区查看。
- 管理区：作品编辑已在阶段 2 迁移到服务端 API；艺术家资料、人员和旧咨询记录仍是明确标注的当前浏览器本地功能。

## 重要说明

公共站的旧资料和未迁移后台功能仍使用浏览器本地存储；作品服务端编辑不会写入或迁移 `yx-site-v2`。换浏览器或清除浏览器数据后，旧本地功能可能会消失。

正式上线时建议升级为服务器数据库、多人员登录权限、真实询价通知、SEO 页面和域名配置。

## 商务后端开发

商务后端正在独立分支中分阶段建设，技术边界为 Cloudflare Pages Functions + D1，后台身份验证使用 Cloudflare Access。阶段 2 已把后台作品编辑切到服务端 API，公共画廊仍未切换到 D1，也没有接入支付。

开发与安全边界详见 `docs/commerce-backend.md`。本地验证入口：

```powershell
npm install
npm run check
```

## 图片素材

图片素材（二进制文件）位于 `assets/` 目录，需要从原项目复制过来：
- artist-portrait.jpg
- cai-lusheng.jpg
- flower-2025.jpg
- grass-2024.jpg
- jiangnan-2024.jpg
- jiangnan-series-6.jpg
- jiangnan-trip.jpg
- studio-1.jpg
