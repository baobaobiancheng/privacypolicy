# 知证 · 隐私政策协作生成器

这是地图导航类首期的本地纵切片。代码只放在本目录，当前默认使用预置身份和冻结内容包，不连接远程仓库、不启动容器、不接入真实客户数据。

## 本地运行

```bash
npm install
npm run dev
```

首次生成草稿前，在 `privacyPolicy/.env.local` 填写服务端模型配置（不要提交到 Git）：

```bash
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

模型调用发生在 Next.js 服务端；浏览器只提交经过 Zod 校验的表单 JSON，不会接触 API Key。DeepSeek 返回 Markdown 政策正文，服务端校验章节和溯源注释后，将 Markdown 同时用于页面预览和 DOCX 编译，文件带律师复核标记。

打开 `http://localhost:3000`，可体验范围门禁、通用披露、五组地图场景、自定义功能、处理活动总览和工作草稿预览。导航右侧的身份菜单仅用于本地角色边界演示，生产环境必须替换为公司 SSO/Auth.js 会话。

验证命令：

```bash
npm run typecheck
npx next build --webpack
```

当前 Next Turbopack 在受限开发环境可能因 CSS 处理器无法绑定内部端口而失败，webpack 构建是等价的生产编译验证路径。

## 代码边界

- `src/content/map-v1/`：不可变 JSON 内容包、Zod schema、引用检查和服务端内容哈希校验。
- `src/domain/rules/`：范围门禁、事实确认、风险、占位符和导出不变量的纯函数。
- `src/domain/draft/`：工作草稿正文与律师复核附录的确定性编排。
- `src/ai/deepseek.ts`：DeepSeek 服务端适配器、表单 JSON 合同、Markdown 章节校验和溯源注释隔离；模型只接收客户表单与参考结构，不接收参考政策全文。
- `components/markdown-preview.tsx`：将模型返回的 Markdown 安全渲染为工作区预览。
- `src/documents/`：服务端 DOCX 渲染器；`/api/draft/demo` 将表单 JSON 送入模型，再返回 Markdown 和同内容的 Word 工作草稿。
- `src/application/`：项目授权和事务命令合同，包含 `commandId + expectedProjectRevision` 乐观并发入口。
- `src/data/`：Prisma 7 + MySQL 驱动适配器、项目授权查询和事实更新事务绑定。
- `src/auth/`：仅开发环境可用的预置身份定义。
- `prisma/schema.prisma`：MySQL 8.4 的 12 张物理表合同；迁移和真实集成测试需在本地数据库准备好后执行。

服务端内容版本可通过 `GET /api/content/map-v1` 检查。示例 DOCX 下载路由只用于本地纵切片，正式版本需接入授权、规范化表单版本记录和幂等导出命令。

## 范围边界

首期只支持单产品、单一地图导航类别、中国境内版本、无跨境处理的工作草稿。参考政策和 AI 候选不会自动成为客户事实；未确认事实只能以显式 `[[待确认:字段]]` 占位符进入复核附录。
