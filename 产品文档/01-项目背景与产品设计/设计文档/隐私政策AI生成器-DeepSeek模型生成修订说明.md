# 隐私政策 AI 生成器：DeepSeek 模型生成修订说明

## 1. 为什么要改

原来的 DOCX 编译器把每个字段标签逐行列出，例如“位置信息 [断言 ID]”。它能证明规则链路，却不是用户可以交付给律师的隐私政策正文。

新的职责划分是：

- 表单负责收集客户事实；
- DeepSeek 负责把已收集事实编排成中文政策段落；
- 确定性规则负责检查范围、字段引用和待确认项；
- DeepSeek 直接返回 Markdown 政策正文；页面渲染 Markdown，DOCX 编译器将同一份 Markdown 排版为 Word，并在附录保留溯源与待办。

## 2. 模型输入不是“快照格式”

浏览器提交一个经过 Zod 校验的 `FormPayload` JSON：

```json
{
  "profile": {
    "operatorName": "杭州行迹科技有限公司",
    "operatorContact": "浙江省杭州市西湖区××路××号",
    "productName": "行迹地图",
    "productVersion": "Android 2.4",
    "contactEmail": "privacy@example.com",
    "rightsEntry": "App 内隐私中心",
    "rightsResponsePeriod": "15 个工作日内回复",
    "minorProcessing": "不面向未成年人，发现后删除",
    "securityMeasures": "访问控制、传输加密、最小权限",
    "incidentChannel": "隐私联系邮箱和 App 公告",
    "policyEffectiveDate": "2026-08-10",
    "policyUpdateNotice": "App 弹窗和隐私政策页提示"
  },
  "selected": ["navigation", "traffic"],
  "customFeatures": ["收藏常用地点"],
  "customDetails": {
    "收藏常用地点": {
      "purpose": "保存用户主动收藏的地点",
      "retention": "用户删除后清除"
    }
  },
  "activityDetails": {
    "navigation": {
      "purpose": "提供路线规划和导航",
      "retention": "导航结束后删除或去标识化"
    }
  },
  "confirmedFields": ["navigation.0", "navigation.1"],
  "additionalNotes": "仅在用户点击开始导航后调用定位 SDK。"
}
```

`FormPayload` 是模型输入合同，不是数据库表结构，也不暴露内部项目修订号。服务端可以在后续版本为这份 JSON 计算规范化哈希并保存审计记录，但模型不需要理解快照实体、外键或 Prisma 对象。

## 3. DeepSeek 生成边界

服务端只发送：

1. `FormPayload` 客户原始输入；
2. 已发布的地图类规则版本和内容哈希；
3. 章节结构提示（概述、收集使用、保存期限、权利、第三方、安全、未成年人、更新与联系）；
4. 已选功能的字段摘要。

不发送高德、百度或其他 App 的隐私政策全文，只使用经法律团队整理的结构提示。参考政策是写作结构证据，不是客户事实或法律依据。

DeepSeek 必须返回 Markdown，不使用 JSON mode：

```markdown
# 行迹地图隐私政策

## 1. 政策概述
本政策适用于杭州行迹科技有限公司提供的行迹地图 Android 2.4。
<!-- assertions: profile.operatorName, profile.productName, profile.productVersion -->

## 2. 我们如何收集和使用个人信息
为提供路线规划和导航，我们会处理位置信息、出发地和到达地。
<!-- assertions: navigation.location, navigation.origin, navigation.destination -->
```

输出必须包含按 1–8 编号的八个章节。涉及客户事实的段落后使用 `<!-- assertions: 字段键 -->` 溯源注释；无法确认的事实使用 `[[待确认:字段键]]`，并用 `<!-- open-item: 字段键 | 原因 -->` 记录待办。注释在页面和 Word 正文中隐藏。

模型返回后必须依次通过：

- Markdown 长度和章节编号校验；
- 溯源注释字段白名单校验；
- 未匹配的模型注释隔离到律师复核附录，不进入正文；
- 规则阻断、冲突和待确认检查。

校验失败、超时或返回空内容时，不写入正文，界面显示稳定错误码并允许重新提交同一份表单。未确认事实只能写成 `[[待确认:字段]]`，并进入律师复核附录。

## 4. 当前代码入口

- `privacyPolicy/src/ai/deepseek.ts`：DeepSeek HTTP 适配器、`FormPayloadSchema` 和模型输出校验。
- `privacyPolicy/app/api/draft/demo/route.ts`：接收表单 JSON，组装规则上下文，调用模型，返回 Markdown 和同内容的 DOCX base64。
- `privacyPolicy/components/markdown-preview.tsx`：安全渲染标题、段落、列表、引用和待确认占位符。
- `privacyPolicy/src/documents/render-draft.ts`：把同一份 Markdown 排版为工作草稿，保留律师复核标记和内容版本。
- `privacyPolicy/components/privacy-workspace.tsx`：新增“表单外补充信息”文本框，提交时作为 `additionalNotes` 进入 JSON。

## 5. 本地配置

在 `privacyPolicy/.env.local` 中填写，不能提交到仓库：

```bash
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

API Key 只在服务端读取；浏览器、DOCX、日志和错误响应均不得包含它。当前无 Key 时接口返回 `MODEL_NOT_CONFIGURED`，不会静默退回字段清单。

## 6. 交付口径

首期输出仍是“工作草稿，未经律师批准”，不是自动发布或“已合规”结论。DeepSeek 解决的是政策文字编排，不替代客户事实确认、律师必要性判断或最终发布审批。
