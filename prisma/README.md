# Core v2 数据库

`schema.prisma` 是当前唯一数据库合同。持久化业务事实以 `Project.formData` 中带 `schemaVersion` 的 JSON 为准；关系表只保留身份授权、项目、生成任务、报告和审计事件。

`20260824190000_core_v2_baseline` 是开发阶段的新基线，不兼容旧演示库，也不会自动重置任何数据库。需要迁移时应先备份并创建新数据库，然后使用：

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
```

Web 路由不得直接编排长任务。生成命令写入 `generation_jobs`，由 `npm run worker` 领取、续租并完成报告落库。
