# 百鉴隐私政策

面向中国境内 App 的隐私政策事实收集与生成服务。首期开放地图导航类，采用版本化 JSON 作为唯一问卷事实源；生成任务由独立 MySQL Worker 异步完成，浏览器轮询查看事实检查、法规检索、正文生成和 Word 制作进度。

当前版本是可运行的开发纵切片，不代表已经完成生产上线条件。生产前仍需接入公司 SSO/OIDC、文件安全扫描、备份恢复、监控告警、对象存储和部署回滚体系。

## 本地运行

需要 Node.js、MySQL 8.x，并在 `.env.local` 中配置 `DATABASE_URL`。模型和法规检索配置只允许保存在服务端环境变量中，不得提交密钥。

```bash
npm install
npm run db:generate
npm run dev
```

另开一个终端启动生成 Worker：

```bash
npm run worker
```

Web 默认位于 `http://127.0.0.1:3000`。开发身份只在 `development` 或 `test` 环境可用；生产环境不会接受 `x-persona-id` 作为登录凭据。

本次重构使用全新的 Core v2 基线，不自动删除旧开发库。若需要从空库开始，请先备份并由开发者显式创建新数据库，再执行：

```bash
npm run db:migrate:deploy
```

## 核心架构

- `src/workspace/contract.ts`：`privacy-form-v2.0.0` 问卷合同，前端、API、Worker 和测试共享。
- `components/workspace/steps/`：六步事实收集界面按步骤物理拆分；`privacy-workspace.tsx` 只负责工作区状态、导航与跨步骤编排。
- `components/workspace/workspace-model.ts`：六步组件共享的显示模型、选项和类型定义。
- `src/application/generation/`：任务入队、租约、心跳、幂等、事实预检、法规检索和报告落库。
- `scripts/generation-worker.ts`：独立 Worker 进程；过期租约可重新领取，最多重试三次。
- `src/storage/report-storage.ts`：报告存储抽象；开发阶段使用 MySQL `LongBlob`，后续可替换对象存储。
- `app/api/v1/`：统一鉴权、参数校验和错误合同的版本化 API。
- `src/domain/ids.ts`：带类型前缀的 UUIDv7 标识符：`prj_`、`gen_`、`rpt_`。

生成期间若项目修订号变化，报告会标记为 `SUPERSEDED`，不会覆盖当前项目的最新可用报告。Word 通过鉴权下载接口流式返回，不会嵌入 Base64 JSON。

## API

- `POST /api/v1/projects`
- `GET /api/v1/projects?limit=20&cursor=...`
- `GET/PUT /api/v1/projects/{projectId}`
- `POST /api/v1/projects/{projectId}/generations`
- `GET /api/v1/projects/{projectId}/generations/{generationId}`
- `GET /api/v1/projects/{projectId}/reports/{reportId}`
- `GET /api/v1/projects/{projectId}/reports/{reportId}/content`

所有失败响应统一为：

```json
{
  "error": {
    "code": "PROJECT_REVISION_CONFLICT",
    "message": "项目已更新，请重新载入。",
    "retryable": true,
    "requestId": "req_xxx",
    "details": {}
  }
}
```

## 验证

```bash
npm test
npm run typecheck
npm run db:validate
npm run build
npm audit --omit=dev
```

真实 MySQL 集成测试使用独立临时数据库，测试结束自动删除：

```bash
RUN_MYSQL_INTEGRATION=1 npm run test:integration
```

DeepSeek 与法规接口在自动化测试中使用 Mock，不产生外部调用费用。
