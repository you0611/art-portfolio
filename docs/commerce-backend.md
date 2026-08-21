# 游祥龙艺术工作室商务后端基础

## 已确认的业务边界

- 所有作品先议价，不提供直接标价购买。
- 面向中国大陆及海外客户。
- 收款主体为个体工商户。
- 包装与运费在议价/订单过程中另行确认。
- 第一阶段只有一位管理员。
- 当前阶段不接支付、不发送真实通知、不迁移真实咨询数据、不改正式站前端数据源。

## 技术选择

- 前端与部署：保留现有 Cloudflare Pages 静态站。
- 后端：Cloudflare Pages Functions。
- 数据库：Cloudflare D1（SQLite 语义），binding 名称固定为 `DB`。
- 后台认证：Cloudflare Access；Pages Functions 再校验 Access JWT 的签名、issuer、audience 和唯一管理员邮箱。
- 图片：现有图片继续作为静态资源。后台上传图片留到后续阶段，再评估 Cloudflare R2。
- 支付：未选择，数据库和 API 不依赖具体支付服务商。

选择这一组合是为了沿用已有 Cloudflare Pages 发布边界，减少新服务器、补丁、端口和操作系统维护。代价是后端运行与数据层依赖 Cloudflare 平台。

## 数据库边界

迁移 `0001_commerce_foundation.sql` 创建：

- `artworks`：作品内容、展示状态、销售状态和议价开关。
- `orders` / `order_items`：客户订单及对应的单件原创作品。
- `offers`：客户与管理员的报价/还价记录。
- `inventory_holds`：作品限时锁定；部分唯一索引保证同一作品最多一个有效锁。
- `admin_audit_log`：后续管理写操作的审计记录。

展示状态与销售状态分离。金额使用整数最小货币单位并附三位币种代码，避免浮点金额。初始 17 件作品均启用议价，现有 12 件为 `available`、5 件为 `sold`。

## API 基础

- `GET /api/health`：验证 Functions 与 D1 是否可用，不返回内部配置。
- `GET /api/artworks`：仅返回已发布作品。
- `GET /api/admin/session`：通过 Access 后返回当前管理员身份。
- `GET /api/admin/artworks`：通过 Access 后返回完整作品管理数据。

管理员 API 的配置缺失、JWT 缺失、签名/issuer/audience 不合法或邮箱不匹配时均拒绝访问。前端密码不得作为后端认证手段。

## 本地开发

1. 执行 `npm install`。
2. 执行 `npm run build`，只把公开静态资产复制到 `dist`；依赖、迁移、文档和测试不得作为网站资产发布。
3. 执行 `npm run db:migrate:local` 创建本地 D1。
4. 执行 `npm run check` 跑约束测试、静态构建、D1 迁移和数据核对。
5. 如需测试管理员 API，将 `.dev.vars.example` 复制为 `.dev.vars` 并填入预览环境值；不得提交真实值。
6. 执行 `npm run dev` 启动 Pages 本地预览。

## 上线前仍需完成

- 在 Cloudflare 创建独立 preview D1 与 production D1，并把真实 ID 写入对应环境配置。
- 创建 Cloudflare Access self-hosted application，只允许唯一管理员身份。
- 在 Pages 预览环境设置 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`ADMIN_EMAIL`。
- 为当前生产 HEAD 新建本阶段专用回退分支/标签。
- 核对实际管理浏览器中的 `yx-site-v2`；其中如含个人咨询数据，需单独确认迁移白名单。
- 实现后台写 API 时增加版本冲突检查、输入验证和 `admin_audit_log` 写入。
- 完成预览验收后，再单独确认生产数据库创建与正式域名切换。

## 当前阶段状态

- 阶段 0（业务与安全规则）：已确认。
- 阶段 1（本地后端与数据库基础）：本地实现与验证已完成；远程资源未创建。
- 阶段 2（安全后台写操作）：未开始。
- 阶段 3（下单与议价交互）：未开始。
- 阶段 4（支付）：未开始。
- 阶段 5（生产安全核验与上线）：未开始。
