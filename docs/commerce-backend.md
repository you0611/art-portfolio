# 游祥龙艺术工作室商务后端基础

## 已确认的业务边界

- 所有作品先议价，不提供直接标价购买。
- 面向中国大陆及海外客户。
- 收款主体为个体工商户。
- 包装与运费在议价/订单过程中另行确认。
- 第一阶段只有一位管理员。
- 当前阶段不接支付、不迁移真实咨询数据、不改正式站前端数据源；真实邮件只有在 Gmail OAuth 配置完成并明确切换模式后才会投递。

## 技术选择

- 前端与部署：保留现有 Cloudflare Pages 静态站。
- 后端：Cloudflare Pages Functions。
- 数据库：Cloudflare D1（SQLite 语义），binding 名称固定为 `DB`。
- 后台认证：Cloudflare Access；Pages Functions 再校验 Access JWT 的签名、issuer、audience 和唯一管理员邮箱。
- 图片：现有图片继续作为静态资源。后台上传图片留到后续阶段，再评估 Cloudflare R2。
- 支付：未选择，数据库和 API 不依赖具体支付服务商。

选择这一组合是为了沿用已有 Cloudflare Pages 发布边界，减少新服务器、补丁、端口和操作系统维护。代价是后端运行与数据层依赖 Cloudflare 平台。

## 数据库边界

迁移 `0001_commerce_foundation.sql` 创建基础表；`0002_stage3_orders.sql` 增加服务端客户联系方式和幂等键；`0003_stage5_followup.sql` 增加本地运营跟进与通知事件记录；`0004_stage5_email_outbox.sql` 增加邮件出站队列：

- `artworks`：作品内容、展示状态、销售状态和议价开关。
- `orders` / `order_items`：客户订单及对应的单件原创作品。
- `offers`：客户与管理员的报价/还价记录。
- `inventory_holds`：作品限时锁定；部分唯一索引保证同一作品最多一个有效锁。
- `admin_audit_log`：后续管理写操作的审计记录。
- `orders.customer_contact`：客户可填写电话、微信或其他联系方式；不在公共响应中返回。
- `orders.idempotency_key`：公共咨询重试时避免重复创建订单。
- `orders.follow_up_status`、`orders.next_follow_up_at`、`orders.admin_note`：独立于交易阶段的跟进状态、下一次跟进时间和管理员备注。
- `notification_events`：新咨询、新报价和订单阶段变化的内部事件记录；事件本身仍不直接发送外部消息，`failed` 状态及失败信息为投递保留。
- `email_outbox`：由通知事件触发的邮件出站队列，记录管理员/客户收件人类型、模板、投递状态、尝试次数和失败信息；默认使用本地假发送器，也支持显式切换到 Gmail API。

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
- `GET/POST /api/admin/notifications`：查看邮件出站记录或执行配置的邮件投递；默认不调用外部服务，`EMAIL_MODE=gmail` 时才调用 Gmail API。
- `GET /api/content`：公开读取艺术家资料、首页/联系文案与已发布履历/动态；浏览器每次重新验证，API 失败时前端继续使用静态内容。
- `GET /api/admin/content`、`PATCH /api/admin/content/profile`：读取和编辑固定白名单资料字段，要求当前 `version`。
- `POST /api/admin/content/entries`、`PATCH /api/admin/content/entries/:id`：新建或编辑履历、活动、人物和合作条目；内容只允许草稿、发布、归档，不提供物理删除。
- `POST /api/admin/content/profile/restore`、`POST /api/admin/content/entries/:id/restore`：恢复上一版，同时把恢复前状态写入修订记录，便于再次回退。
- 管理 API 全部返回 `Cache-Control: no-store`；`held` 不属于管理员直接设置的状态，必须由后续库存锁流程产生。
- 过期 hold 会在涉及可用性或后台订单列表的请求开始时被清理，作品和订单状态一起恢复；本地阶段不引入额外定时服务。

管理员 API 的配置缺失、JWT 缺失、签名/issuer/audience 不合法或邮箱不匹配时均拒绝访问。前端密码不得作为后端认证手段。独立 Cloudflare Preview 例外使用 Pages Functions 服务端门禁：密码只存在 Pages Secret，通过后签发短期 `HttpOnly`、`Secure` Cookie；正式配置不启用这条路径。

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

## 阶段 3 后续：上线前硬化与咨询转化

- 公共首页、主画廊、作品总览和活动页补齐分享元数据与 canonical；后台从 sitemap 和爬虫范围中移除。
- 旧测试页不再进入构建产物；作品图片使用明确的首屏/延迟加载策略，并补充菜单状态、表单状态和空库存处理。
- 独立作品页的咨询按钮会把当前作品带入收藏咨询表单；提交说明明确运输与付款另行协商，不在本阶段接入支付。

## 阶段 5A：本地运营能力

- 管理后台可以按跟进状态筛选咨询，并按下一次跟进时间、最近更新或创建时间排序。
- 管理员可以保存“未处理 / 沟通中 / 已完成 / 已取消”、下一次跟进时间和备注；这些字段不改变交易阶段。
- 数据库触发器为新咨询、新报价和订单阶段变化写入 `notification_events`，避免业务 API 分支遗漏事件；当前只记录，不连接邮件、微信或其他外部账号。
- 订单详情会显示事件记录及其投递状态；真实通知接入前，`failed` 只能作为内部失败状态保存，不能宣称已经发送。
- 新咨询会生成管理员邮件出站记录；管理员报价会生成客户邮件出站记录；本地后台默认“模拟投递”只更新 D1 状态，不发送网络请求。
- 本地假发送已覆盖成功、跳过、失败和重试；真实邮件服务接入仍需单独配置发件域名、API 密钥、队列执行和退信处理。
- Gmail 适配器与一次性 OAuth 授权脚本已加入本地代码；只有 `EMAIL_MODE=gmail` 且 OAuth 配置完整时才会通过 Gmail API 发送，授权密钥不进入 Git。
- 当前仍不读取、导入或迁移旧浏览器中的真实咨询记录。

## 阶段 5C：内容管理服务端化

- `0005_stage5_content.sql` 新增固定字段 `site_profiles`、履历/活动/人物/合作 `site_entries` 和 `site_content_revisions`；只迁移网站代码里已有的 1 份艺术家资料与 22 条履历。
- 旧 `localStorage` 中“站点管理员 / 作品编辑”占位角色不作为人物资料迁移；活动、人物和合作初始均为 0，不创造未经证实的经历。
- 管理后台“内容资料”和“履历与动态”改为服务端读取与保存，所有写入使用字段白名单、长度/枚举/HTTPS 校验、乐观锁、事务审计和修订快照。
- 内容不物理删除，只能归档；取消公开后仍可在后台核查。资料与条目均支持恢复上一版。
- 公开页先显示现有静态内容，再读取 `/api/content`；网络或 API 失败不会把页面清空。服务端文案和履历使用 `textContent` 构建 DOM，避免把管理员输入作为 HTML 执行。
- 图片上传、支付、真实邮件、真实客户数据和正式生产发布不在本阶段。

## 本地开发

1. 执行 `npm install`。
2. 执行 `npm run build`，只把公开静态资产复制到 `dist`；依赖、迁移、文档和测试不得作为网站资产发布。
3. 执行 `npm run db:migrate:local` 创建本地 D1。
4. 执行 `npm run check` 跑约束测试、静态构建、D1 迁移和数据核对。
5. 如需本地测试管理员 API，可在被 Git 忽略的 `.dev.vars` 设置本地管理员邮箱；Access 域名和 audience 未配置时，管理员 API 必须保持 503 拒绝。不得提交真实值。
6. 执行 `npm run dev` 启动 Pages 本地预览。

## Gmail 发件配置（本地、显式开启）

当前已确认的发件账号由本地环境变量提供，不写入前端、测试或知识库。管理员收件人仍使用 `ADMIN_EMAIL`；Gmail 发件账号使用 `GMAIL_FROM_EMAIL`。

1. 在 Google Cloud 中启用 Gmail API，创建 OAuth 2.0 Web application 凭据，并把 `http://127.0.0.1:8789/oauth/callback` 加入授权回调地址。
2. 在被 Git 忽略的 `.dev.vars` 中填写 `GMAIL_CLIENT_ID`、`GMAIL_CLIENT_SECRET`、`GMAIL_FROM_EMAIL`，暂时保持 `EMAIL_MODE=local-fake`。
3. 执行 `npm run gmail:authorize`，在 Google 页面完成授权；脚本会把 `GMAIL_REFRESH_TOKEN` 自动保存到被 Git 忽略的 `.dev.vars`。不要把 client secret 或 refresh token 发到聊天、提交 Git 或放入前端。
4. 确认要做真实测试时，把本地 `.dev.vars` 的 `EMAIL_MODE` 改为 `gmail`，重启 `npm run dev`，再在后台点击“投递邮件”。
5. 验收通过后恢复 `EMAIL_MODE=local-fake`；Cloudflare Preview/Production 的 Secret、D1 和 Access 仍需另行授权与验收，本地配置不会自动发布。

真实投递顺序是：新咨询通知 `ADMIN_EMAIL`；管理员报价通知客户咨询中保存的邮箱。每封邮件仍经过 `email_outbox`，失败会保留状态并按尝试次数重试；当前没有自动退信处理。

## 上线前仍需完成

- 独立 Preview Pages 与 D1 已创建并完成迁移及纯测试写验收；production D1 仍未创建。
- 创建 Cloudflare Access self-hosted application，只允许唯一管理员身份。
- 正式环境启用前设置 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`ADMIN_EMAIL`。本次 Preview 因 Zero Trust 免费版激活要求银行卡及超额扣费授权，未开通 Access，改用仅对 Preview 开启的服务端密码门禁。
- 本地验证可在未提交的 `.dev.vars` 中设置 `LOCAL_ADMIN_PREVIEW=true`；它只对 `localhost`、`127.0.0.1`、`::1` 请求生效，不能绕过非本地环境的 Cloudflare Access。生产和 Cloudflare 预览仍必须配置 Access。
- 为当前生产 HEAD 新建本阶段专用回退分支/标签。
- 核对实际管理浏览器中的 `yx-site-v2`；其中如含个人咨询数据，需单独确认迁移白名单。
- Preview 已用 `.invalid` 邮箱和纯测试身份完成咨询、客户报价、管理员报价、hold、释放和取消；两条已取消 fixture 记录按验收边界保留，未删除或混入真实客户资料。
- Preview 已完成内容资料保存、公开页即时读取、恢复上一版、履历归档/恢复、审计和手机/桌面布局验收；验收产生的内容修订和审计 fixture 已清理，服务端内容回到迁移基线。
- 限时 hold 的跨请求行为已经验证；正式 Access 授权身份和生产部署回滚仍待单独验收，不能直接跳到生产。
- 完成预览验收后，再单独确认生产数据库创建与正式域名切换。

## 当前阶段状态

- 阶段 0（业务与安全规则）：已确认。
- 阶段 1（本地后端与数据库基础）：本地实现与验证已完成；远程资源未创建。
- 阶段 2（安全后台写操作）：本地与独立 Preview 纯测试写验收已完成；production 未创建。
- 阶段 3（下单与议价交互）：咨询、双方报价、hold、释放和取消已在独立 Preview 完整验收。
- 阶段 3 后续（上线前硬化与咨询转化）：Preview 已设置 `noindex` 和全站爬虫禁止规则；桌面和手机公开页/后台均完成只读交互验收。
- 阶段 5C（内容管理服务端化）：本地与独立 Preview 验收已完成；图片和 production 未开始。

## 独立 Cloudflare Preview（2026-08-25）

- Pages 项目：`yx-art-studio-preview`；入口：`https://yx-art-studio-preview.pages.dev`。
- D1：`yx-art-studio-commerce-preview`，含 17 件已核对作品（12 件可咨询、5 件已售）、1 份服务端资料与 22 条已发布履历；活动、人物和合作初始为空。
- Preview 配置：`EMAIL_MODE=local-fake`、`PREVIEW_GATE_ENABLED=true`；`PREVIEW_GATE_PASSWORD` 与 `ADMIN_EMAIL` 由 Pages Secret 提供，不记录值。
- 未登录页面/API 与错误密码返回 401；成功登录后健康检查和后台会话返回 200。门禁 Cookie 有效期 8 小时，使用 `HttpOnly`、`Secure`、`SameSite=Strict`。
- Preview 的 `robots.txt` 禁止全站抓取，并附加 `X-Robots-Tag: noindex, nofollow, noarchive`。正式域名、DNS、生产分支和正式 Pages 项目未修改。
- 旧的无门禁部署 `ccb1f7be-d06c-4f7a-8235-1f9f5f4511e0` 已删除并验证为 404；当前受保护部署为 `b6b4e1cc-1788-4eae-9f74-2e9cc58c42a9`，对应提交 `61a7366`。
- 回滚门禁需要重新部署；不得仅关闭 `PREVIEW_GATE_ENABLED` 后继续公开使用。删除 Preview Pages 或 D1 是独立的破坏性操作，必须再次确认精确资源。
- 阶段 5A（运营能力）：本地和独立 Preview 验收已完成；通知保持 `local-fake`，未发送真实邮件。
- 阶段 4（支付）：未开始。
- 阶段 5（生产安全核验与上线）：未开始。
