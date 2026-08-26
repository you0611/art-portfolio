# 游祥龙艺术工作室网站本地版

执行 `npm run dev` 可启动包含 Pages Functions 和本地 D1 的预览；只打开 `index.html` 只能查看不依赖后端的静态界面。

## 当前包含

- 双语切换：中文 / English。
- 作品板块：作品列表、搜索、分类筛选、作品详情。
- 作品详情：标题、媒介、尺寸、年份、价格或"价格请咨询"、状态、简介、收藏咨询入口。
- 艺术家板块：肖像、简介、展览时间线。
- 收藏咨询：提交到本地服务端，生成咨询编号并进入议价流程。
- 管理区：作品编辑、作品主图、内容资料和商务咨询已迁移到服务端 API；可维护作品图片、恢复上一张、查看咨询、发送报价并占用/释放作品。
- 旧咨询记录仍是明确标注的当前浏览器本地功能，不会自动迁移。

## 重要说明

公共站的旧资料和未迁移后台功能仍使用浏览器本地存储；作品服务端编辑不会写入或迁移 `yx-site-v2`。换浏览器或清除浏览器数据后，旧本地功能可能会消失。

正式上线时建议升级为服务器数据库、多人员登录权限、真实询价通知、SEO 页面和域名配置。

## 商务后端开发

商务后端正在独立分支中分阶段建设，技术边界为 Cloudflare Pages Functions + D1，正式后台的目标身份验证仍是 Cloudflare Access。阶段 2、阶段 3 及上线前硬化已完成本地验证；独立 Cloudflare Preview 使用服务端密码门禁，不接支付、真实通知或真实客户数据。

开发与安全边界详见 `docs/commerce-backend.md`。本地验证入口：

```powershell
npm install
npm run check
```

独立 Preview 配置使用 `wrangler.preview.jsonc`，只绑定 `yx-art-studio-commerce-preview` 与私有桶 `yx-art-studio-media-preview`。门禁密码与管理员邮箱是 Cloudflare Pages Secret，不写入仓库；正式 `wrangler.jsonc` 不启用门禁。

## 图片素材

原有图片素材（二进制文件）位于 `assets/` 目录，并作为服务端图片不可用时的回退。Phase 5D 已在本地和独立 Preview 验证私有 R2 binding；Production R2 尚未创建，现有作品图尚未迁移：
- artist-portrait.jpg
- cai-lusheng.jpg
- flower-2025.jpg
- grass-2024.jpg
- jiangnan-2024.jpg
- jiangnan-series-6.jpg
- jiangnan-trip.jpg
- studio-1.jpg
