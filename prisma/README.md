# 本地 MySQL 数据层

`schema.prisma` 是首期 12 张物理表的关系合同，使用 Prisma 7 配置文件读取 `DATABASE_URL`。当前工作区只完成 schema 验证与客户端生成，不会在未获批准的情况下连接或修改数据库。

准备本地 MySQL 8.4 后：

```bash
cp .env.example .env
# 按本机数据库修改 DATABASE_URL
npm run db:validate
npm run db:generate
npx prisma migrate dev --name init
```

写入前必须补齐种子用户、地图内容 Evidence 和项目授权。所有编辑命令都应经过 `src/application/commands` 的 `commandId + expectedProjectRevision` 合同；页面不得直接调用 Prisma Client。
