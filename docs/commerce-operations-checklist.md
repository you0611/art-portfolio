# 商务运营与数据恢复检查清单

本清单服务于本地阶段 5A 和之后的独立 Preview 验收。它不授权创建 Cloudflare 资源、不授权读取真实客户资料，也不替代正式的备份制度。

## 日常跟进

- [ ] 先按“未处理”筛选咨询，再按下一次跟进时间排序。
- [ ] 每次联系后更新跟进状态、下一次跟进时间和管理员备注。
- [ ] 报价、接受报价、释放占用和取消订单后，检查订单阶段与作品销售状态是否一致。
- [ ] 查看订单详情中的内部通知事件；`failed` 事件不得被当作已经发送。
- [ ] 在接入真实邮件前，可在后台执行“模拟投递”验证出站队列；“已发送（模拟）”不等于真实邮箱已收到。
- [ ] 真实邮件、微信、短信或支付账号接入前，单独定义凭据、重试、去重和失败告警方案。

## 本地导出与恢复演练

只对明确的目标数据库执行；导出的 SQL 可能包含客户联系方式，不得提交 Git、上传到知识库或发送给外部服务。

先运行不接触现有本地数据库的自动化演练：

```powershell
npm run db:recovery:fixture
```

该脚本在系统临时目录中创建两个隔离的 Wrangler 本地状态：迁移源数据库、写入非真实 fixture、导出、恢复到第二个数据库，并核对作品/订单/通知/邮件队列、库存唯一索引和咨询幂等约束；结束后自动删除临时目录。它证明恢复链路可执行，但不代表 Preview 或 Production 的真实备份已经完成。

```powershell
# 先确认命令版本与目标，再执行；这里的文件名只是示例，不在本阶段自动创建。
npx wrangler d1 export yx-art-studio-commerce --local --output .\private-backup\commerce-local.sql
npx wrangler d1 execute yx-art-studio-commerce --local --file .\private-backup\commerce-local.sql
```

- [ ] 导出前确认当前是 local、preview 还是 production；三者不可混用。
- [ ] 恢复演练使用隔离数据库或可丢弃的本地数据库，不直接覆盖正式数据。
- [x] 隔离 fixture 恢复后核对作品数量、订单、事件、邮件队列、唯一库存占用索引和咨询幂等约束。
- [ ] Preview/Production 恢复后核对 migration、作品数量、订单状态、跟进字段、事件记录和唯一库存占用约束。
- [ ] 演练结束后删除含客户资料的临时导出，并确认没有进入构建产物或 Git 状态。

## Preview 前置验收

- [ ] 阶段 5A 本地测试、构建、迁移和恢复演练全部通过。
- [ ] Preview 使用独立 D1；不绑定 production D1，不导入真实客户数据。
- [ ] Preview 后台仅由 Cloudflare Access 保护；未授权请求返回拒绝，不回退到前端密码。
- [ ] Preview 设置 `noindex`，并完成移动端、桌面端、重试、版本冲突和事件记录检查。
- [ ] Preview 通过后单独记录问题与回滚点；不自动修改正式 DNS、生产分支或支付配置。
