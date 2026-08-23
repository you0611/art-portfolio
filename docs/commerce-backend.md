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

迁移 `0001_commerce_foundation.sql` 创建基础表；`0002_stage3_orders.sql` 增加服务端客户联系方式和幂等键：

- `artworks`：作品内容、展示状态、销售状态和议价开关。
- `orders` / `order_items`：客户订单及对应的单件原创作品。
- `offers`：客户与管理员的报价/还价记录。
- `inventory_holds`：作品限时锁定；部分唯一索引保证同一作品最多一个有效锁。
- `admin_audit_log`：后续管理写操作的审计记录。
- `orders.customer_contact`：客户可填写电话、微信或其他联系方式；不在公共响应中返回。
- `orders.idempotency_key`：公共咨询重试时避免重复创建订单。

展示状态与销售状态分离。金额使用整数最小货币单位并附三位币种代码，避免浮点金额。初始 17 件作品均启用议价，现有 12 件为 `available`、5 件为 `sold`。

## API 基础

- `GET /api/health`：验证 Functions 与 D1 是否可用，不返回内部配置。
- `GET /api/artworks`：仅返回已发布作品。
- `GET /api/admin/session`：通过 Access 后返回当前管理员身份。
- `GET /api/admin/artworks`：通过 Access 后返回完整作品管理数据。
- `GET /api/admin/artworks/:id`：通过 Access 后返回单件作品及其 `version`。
- `PATCH /api/admin/artworks/:id`：只允许固定作品字段白名单，要求客户端提交当前 `version`，使用参数绑定和乐观锁；成功修改与 `admin_audit_log` 写入通过 D1 `batch()` 处于同一事务边界。
- `POST /api/orders`：提交一件可议价作品的收藏咨询，返回不可猜的咨询编号；请求支持 `Idempotency-Key`，公共响应不返回客户联系方式。
- `GET /api/orders/:reference`：凭咨询编号查询阶段和最新报价的非敏感摘要。
- `POST /api/orders/:reference/offers`：客户提交报价；只允许仍开放议价的咨询。
- `GET /api/admin/orders`、`GET /api/admin/orders/:id`：Access 保护下查看服务端咨询及报价。
- `PATCH /api/admin/orders/:id`：管理员按版本号推进 `negotiating`、`awaiting_payment`、`cancelled` 三个阶段，拒绝跳跃状态。
- `POST /api/admin/orders/:id/offers`：管理员发送报价，要求当前订单 `version`。
- `POST /api/admin/orders/:id/hold`：管理员明确接受一份待处理报价并创建限时库存 hold；作品改为 `held`、报价接受、订单变为 `awaiting_payment` 处于同一 D1 batch。
- `POST /api/admin/orders/:id/release-hold`：释放 hold，作品回到 `available`，订单回到 `negotiating`。
- 管理 API 全部返回 `Cache-Control: no-store`；`held` 不属于管理员直接设置的状态，必须由后续库存锁流程产生。
- 过期 hold 会在涉及可用性或后台订单列表的请求开始时被清理，作品和订单状态一起恢复；本地阶段不引入额外定时服务。

管理员 API 的配置缺失、JWT 缺失、签名/issuer/audience 不合法或邮箱不匹配时均拒绝访问。前端密码不得作为后端认证手段。

## 阶段 2 本地实现

- 已完成管理员作品读取与 PATCH 写 API，输入校验覆盖字段白名单、字符串长度、年份、枚举、金额、货币和站内图片路径。
- 已移除前端硬编码密码及 `sessionStorage` 解锁流程；公共页管理入口直接进入 `admin.html`，认证由 Cloudflare Access 和 Pages Functions 双重负责。
- 后台作品页改为服务端读取/保存并携带 `version`；版本冲突显示“数据已被其他修改刷新，请重新加载”。
- 艺术家资料、人员、旧咨询记录保留为明确标注的旧本地功能，本阶段不读取、上传或迁移其中内容。
- 本地自动测试覆盖初始数据、约束、访问默认拒绝、PATCH/409、非法输入、审计和前端密码移除；远程 preview 尚未在本节声称完成。

## 阶段 3 本地实现

- 已把新的公共咨询从 `yx-site-v2` 本地写入迁移为服务端 `orders` / `order_items`，保留旧浏览器记录但不读取、不上传、不导入。
- 已实现客户报价、管理员报价、订单阶段状态、版本冲突和服务端管理列表；管理员报价和状态写入均有审计。
- 已实现显式接受报价后创建限时 hold、单作品一个 active hold、释放 hold、过期 hold 清理；不能通过作品 PATCH 直接写入 `held`。
- 新增本地管理页“商务咨询”面板，可读取咨询、发送报价、接受报价并占用/释放作品；仍保持原有页面风格，不进行视觉重设计。
- 阶段 3 测试覆盖咨询幂等、公共响应不含联系方式、议价、hold/释放、过期清理、非法输入、版本冲突和审计失败回滚。
- 当前所有客户和管理员测试数据均为 fixture；本阶段不接支付、邮件、短信、真实通知或生产数据。

## 本地开发

1. 执行 `npm install`。
2. 执行 `npm run build`，只把公开静态资产复制到 `dist`；依赖、迁移、文档和测试不得作为网站资产发布。
3. 执行 `npm run db:migrate:local` 创建本地 D1。
4. 执行 `npm run check` 跑约束测试、静态构建、D1 迁移和数据核对。
5. 如需本地测试管理员 API，可在被 Git 忽略的 `.dev.vars` 设置本地管理员邮箱；Access 域名和 audience 未配置时，管理员 API 必须保持 503 拒绝。不得提交真实值。
6. 执行 `npm run dev` 启动 Pages 本地预览。

## 上线前仍需完成

- 在 Cloudflare 创建独立 preview D1 与 production D1，并把真实 ID 写入对应环境配置。
- 创建 Cloudflare Access self-hosted application，只允许唯一管理员身份。
- 在 Pages 预览环境设置 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`ADMIN_EMAIL`。
- 为当前生产 HEAD 新建本阶段专用回退分支/标签。
- 核对实际管理浏览器中的 `yx-site-v2`；其中如含个人咨询数据，需单独确认迁移白名单。
- 对阶段 2/3 做 Cloudflare preview D1、Access 和 Pages 预览验收；本地代码已具备版本冲突检查、输入验证和审计边界。
- 在 preview 通过后，再检查限时 hold 的跨请求行为、Access 授权身份和部署回滚；仍不能直接跳到生产。
- 完成预览验收后，再单独确认生产数据库创建与正式域名切换。

## 当前阶段状态

- 阶段 0（业务与安全规则）：已确认。
- 阶段 1（本地后端与数据库基础）：本地实现与验证已完成；远程资源未创建。
- 阶段 2（安全后台写操作）：本地实现已完成，preview D1 / Access / Pages 远程验收待完成。
- 阶段 3（下单与议价交互）：本地实现与验证已完成；云端 preview 尚未创建。
- 阶段 4（支付）：未开始。
- 阶段 5（生产安全核验与上线）：未开始。
