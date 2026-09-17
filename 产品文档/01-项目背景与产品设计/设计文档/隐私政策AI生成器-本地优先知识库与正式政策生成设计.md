# 隐私政策 AI 生成器：本地优先知识库与正式政策生成设计

> **后续设计修订（2026-08-14）**：本文的动态补充问题、竞品资料运行时使用方式和输出长度规则，已由《隐私政策AI生成器-方案F槽位驱动动态补充设计》替代。高德、百度原文及完整提取表不在项目运行时整份发送给模型；“三万字”表示输出容量不得过小，不是正文最低长度；首期不包含律师审批工作流。

生成日期：2026-08-13  
状态：APPROVED  
模式：Startup / 公司内部创新项目  
适用范围：地图导航类第一期

## 一、结论

第一期不建设向量数据库，也不在客户生成政策时实时查询付费法律接口。

采用“版本化本地内容包 + 确定性检索 + 缺口触发人工查询”的方案：

1. 现有法规全文和高德、百度提取表作为原始资料池；
2. 法律团队从原始资料池中审核并发布小而可信的地图类知识包；
3. 客户填写时，系统从知识包中匹配可能遗漏的事项，并以中性问题询问客户是否存在；
4. 客户确认后的事实与适用法规规则组成章节事实包；
5. DeepSeek 按三个章节组生成正式质量的 Markdown，再做一次全篇统一；
6. 律师复核并批准后，系统输出无水印正式隐私政策 Word；
7. 本地知识确有缺口时，创建内部资料任务，由律师决定是否调用付费接口。查询结果经过审核发布后，才可用于后续项目。

客户不会看到“高德收集了什么”“百度如何写”等内部资料。客户页面只展示中性提示，所有候选默认不选。

## 二、问题与现状

### 2.1 当前生成文本为什么不像正式政策

当前生成链路只使用 `privacyPolicy/src/content/map-v1/map-v1.0.0.json` 中的一条法规摘要、五组功能及固定八章结构。它没有读取现有法规正文、高德提取表或百度提取表。

因此当前结果存在以下问题：

- 按字段罗列信息，缺少按处理场景展开的完整说明；
- 缺少处理目的、触发条件、处理方式、敏感性、必要性说明、拒绝影响与用户控制路径的组合表达；
- Cookie、设备权限、自动化决策、SDK、第三方、共享、转让、公开披露等条件章节不完整；
- 用户权利、保存与删除、安全事件、未成年人、政策变更、联系与争议解决等通用章节过于笼统；
- 使用“工作草稿”“待确认”“内部断言编号”等研发和复核语言，无法直接作为对外政策文本；
- 生成前没有系统性发现遗漏事实，模型只能把不完整表单扩写成一篇更长的不完整文本。

正式政策的核心瓶颈不是 DeepSeek 输出长度，而是生成前的事实完整度。

### 2.2 现有法规数据审计

本地已有：

- 443 条法规检索记录；
- 437 条法规详情记录；
- 按 `lawId` 去重后约 354 部法规；
- `law_detail_results.json` 约 18 MB；
- 《个人信息保护法》《网络安全法（2025年修正）》《数据安全法》《网络数据安全管理条例》《未成年人网络保护条例》《移动互联网应用程序信息服务管理规定》等核心正文。

这些数据有复用价值，但不能整体直接进入正式生成链路。现有批处理以搜索结果第一条作为正确结果，没有标题、发文机关和文号复核，已发现明确错配：

| 目标资料 | 当前错误命中 |
|---|---|
| 《常见类型移动互联网应用程序必要个人信息范围规定》 | 人工智能科技伦理审查与服务文件 |
| 《App违法违规收集使用个人信息行为认定方法》 | 防范治理电信网络诈骗工作机制 |
| 《信息安全技术 个人信息安全规范》 | 合规审计人员能力评价通知 |

437 条有结果记录中，标题完全一致的记录为 63 条；放宽到标题互相包含的记录为 133 条。该统计不是最终准确率，但足以证明“搜索第一条直接可信”不可作为生产规则。

### 2.3 现有类似产品资料

高德和百度提取表已经按以下维度整理：

- 章节结构；
- 产品范围与运营主体；
- 业务场景与处理活动；
- 个人信息类别和具体字段；
- 信息来源、处理目的、必要性、敏感性；
- 权限、Cookie、营销与个性化推荐；
- 第三方、SDK、共享、转让和公开披露；
- 保存、安全、未成年人和用户控制方式；
- 原文依据和章节位置。

两份 Markdown 提取表合计约 209 KB。它们比把两份完整政策全文交给模型更适合程序检索，因为提取表已经把长文本转化为业务场景和可追问字段。

原始政策全文仍需保留，但只用于人工核查和少量写法示例检索，不整篇发送给 DeepSeek。

## 三、产品边界

### 3.1 输出状态

系统采用三级 `publicationState`；它只描述文本发布阶段，不等于资料完整度诊断：

| 状态 | 用户看到的名称 | 可下载内容 | 条件 |
|---|---|---|---|
| 事实收集中 | 信息待补充 | 不生成正式文件 | 存在发布级事实缺口 |
| 待律师批准 | 隐私政策待批准版本 | 可预览，可下载带“待律师批准”标识的 Word | 客户事实完整，尚未完成律师批准 |
| 已批准 | 正式隐私政策 | 无水印正式 Word | 律师批准并冻结输入、规则和文本版本 |

“待批准版本”也必须是连续、完整、面向公众的正式文体，不出现技术编号、断言 ID、内部附录或 `[[待确认]]`。尚未确认的发布级事实在生成前阻断，而不是作为占位符进入正文。

### 3.2 三类资料的职责

| 资料层 | 能做什么 | 不能做什么 |
|---|---|---|
| 法规规则 | 决定披露要求、适用条件、风险与律师判断点 | 不能证明客户实际采用某项功能 |
| 类似产品案例 | 提醒可能遗漏的场景，提供结构和表达参考 | 不能直接写成客户事实或法律结论 |
| 客户确认事实 | 作为政策正文中的事实来源 | 不能自动等同于法律上必要或合规 |

## 四、本地优先知识库结构

### 4.1 不采用向量数据库的原因

地图类第一期的规则和场景数量有限，且法律内容需要可解释、可复核、可复现。标签与条件检索比向量相似度更容易测试，也不会因为模型或 embedding 版本变化而返回不同规则。

第一期使用版本化 JSON 内容包和 Zod 校验。MySQL 保存项目、客户答案、确认、律师审核和生成版本；知识内容本身不拆成大量业务表。

只有当后续扩展到多类别、数百份参考政策，并且标签召回率无法满足要求时，再评估全文或向量检索。

### 4.2 原始资料区与发布区

```text
法规数据/已获取数据/                 原始资料区，不直接供运行时使用
隐私政策文本资料/01_地图导航类/       原始政策与人工提取表
        │
        ▼ 离线清洗、复核、结构化
privacyPolicy/src/knowledge/
  packages/
    map-cn-v1.0.0/                   版本目录，发布后只读
      manifest.json                  内容包信封和文件级哈希
      regulations/
        documents.json               法规元数据
        provisions.json              相关条款
        rules.json                   可执行披露规则
      references/
        scenarios.json               类似产品业务场景
        writing-patterns.json        经过改写的写作模式
      prompts/
        supplement-questions.json    动态补充问题
      indexes/
        tag-index.json               构建产物，不人工维护
```

原始资料区允许存在尚未确认或错误匹配的候选。发布区只能包含经过法律人员确认的记录。

### 4.3 内容包信封

每个发布包必须包含：

```json
{
  "schemaVersion": "1",
  "contentVersion": "map-cn-v1.0.0",
  "packageHash": "sha256:...",
  "publishedAt": "2026-08-13T00:00:00Z",
  "publishedBy": "legal-reviewer-id",
  "jurisdiction": "CN",
  "appCategories": ["MAP_NAVIGATION"],
  "sources": {
    "regulationVersion": "map-reg-1.0.0",
    "referenceVersion": "map-ref-1.0.0",
    "questionVersion": "map-question-1.0.0",
    "templateVersion": "map-policy-template-1.0.0"
  },
  "files": [
    {
      "path": "regulations/rules.json",
      "schemaVersion": "1",
      "sha256": "...",
      "size": 12345
    }
  ]
}
```

发布后禁止原地覆盖。修改内容必须生成新版本，旧项目继续关联旧版本，除非律师明确发起升级评估。哈希使用 UTF-8 canonical JSON：对象键按 Unicode 码点排序、数组保持业务顺序、无无意义空白、时间统一 UTC ISO 8601。加载时校验 manifest、逐文件哈希、文件大小、Schema、ID 唯一性和跨文件引用完整性；任一失败则整个内容包不可用。

`files` 必须枚举全部运行时文件，路径只能是包目录内的规范化相对路径，禁止绝对路径、`..` 和重复路径。`packageHash = sha256(canonical(manifest 去除 packageHash/signature 字段) + 按 path 排序的全部文件 sha256)`；manifest 本身由应用构建清单或后续签名机制校验，避免自引用哈希。

`schemaVersion` 表示数据结构兼容性，`contentVersion` 表示法律内容变化。程序必须声明支持的 `schemaVersion`；不支持时返回 `KNOWLEDGE_SCHEMA_UNSUPPORTED`，不得宽松解析。每个 Schema 提供有效 fixture、缺字段 fixture、重复 ID fixture、坏引用 fixture 和哈希不符 fixture。

### 4.4 知识记录生命周期

```text
CANDIDATE → VERIFIED → PUBLISHED → SUPERSEDED
                  └─→ QUARANTINED → REVOKED
```

- `CANDIDATE`：自动检索、提取或人工录入，不能参与运行时生成；
- `VERIFIED`：已核对标题、机关、文号、时效性、正文和来源，尚未发布；
- `PUBLISHED`：属于一个不可变内容包，可参与运行时检索；
- `SUPERSEDED`：被新版本替代，旧项目仍可读取，禁止新项目选用；
- `QUARANTINED`：发现疑似错误，立即禁止新生成并启动影响扫描；
- `REVOKED`：确认错误或失效，保留审计记录，不得继续使用。

官方发布机关和国家法律法规数据库来源优先于商业聚合库。核心规则原则上由两名法律人员复核；内部试点允许一名指定负责人复核，但必须记录例外原因。

每个规则、问题、写作模式都保存上游来源 ID。来源进入 `QUARANTINED/REVOKED` 时，系统反向查找受影响的规则、知识包、生成记录和已批准政策：4小时内阻断新生成，1个工作日内形成影响清单，由律师决定撤包、回滚或创建存量政策复审任务。历史批准记录不得删除。

不可变内容包之外维护 append-only `KnowledgeStatusRegistry`。注册表写入状态事件，而非更新 current row；每个事件包含单调 `eventSequence`、`expectedVersion`、状态、操作者、原因和时间，通过 CAS 防止并发乱序。当前态是按序折叠事件得到的 materialized view。运行时同时验证包哈希和当前态。紧急 kill switch 只能禁止新操作，不能修改或删除包文件。影响扫描使用 `statusEventId + packageHash` 作为幂等键。

| 来源状态 | 可转目标 | 操作角色 | 主要副作用 |
|---|---|---|---|
| CANDIDATE | VERIFIED / QUARANTINED | 法律审核人 | 验证或隔离候选 |
| VERIFIED | PUBLISHED / QUARANTINED | 法律负责人、发布管理员 | 发布新包或退回复核 |
| PUBLISHED | SUPERSEDED / QUARANTINED | 法律负责人 | 切换版本或紧急阻断 |
| QUARANTINED | VERIFIED / PUBLISHED / REVOKED | 两名审核人或负责人审批例外 | 恢复或撤销 |
| SUPERSEDED | QUARANTINED | 法律负责人 | 历史风险扫描 |
| REVOKED | 无 | 无 | 终态，仅保留审计和替代版本 |

### 4.5 核心数据对象

#### RegulationDocument

- `documentId`
- `title`
- `lawId`
- `issuingOrgans`
- `documentNumber`
- `status`

图级的 `maxDepth`、`maxQuestions` 和入口问题列表属于 `QuestionnaireManifest`，不在每个问题中重复定义。
- `effectiveDate`
- `sourceUrl`
- `sourceHash`
- `verifiedBy`
- `verifiedAt`

#### RegulationProvision

- `provisionId`
- `documentId`
- `articleNumber`
- `text`
- `topicTags`
- `sourceLocator`

法规全文不进入每次模型输入。只保存和召回与隐私政策披露直接相关的条款。

#### LegalRule

- `ruleId`
- `title`
- `appliesWhen`
- `requiredFacts`
- `disclosureRequirement`
- `blockingLevel`
- `legalReviewRequired`
- `provisionIds`
- `effectiveFrom`
- `effectiveTo`
- `priority`
- `ruleClass`
- `conflictGroup`
- `unknownPolicy`
- `missingPolicy`
- `outputs`

`appliesWhen` 使用有限条件表达式，例如：

```json
{
  "all": [
    { "fact": "category", "equals": "MAP_NAVIGATION" },
    { "fact": "activities.navigation.enabled", "equals": true }
  ]
}
```

规则 DSL 第一版只支持 `all`、`any`、`not`、`equals`、`in`、`contains`、`exists`，以 Zod discriminated union 定义。事实状态为 `KNOWN(value)`、`UNKNOWN`、`MISSING`；`false`、`null`、空字符串和空数组是不同的已知值。每条规则声明遇到 `UNKNOWN/MISSING` 时是 `SKIP`、`ASK` 或 `BLOCK`。`equals` 只比较同类型 scalar；`in` 判断 scalar 是否位于常量数组；`contains` 判断已知数组是否包含同类型值；`exists` 仅判断是否为 `KNOWN`。类型不兼容在构建期报错。

求值顺序固定为 `scope block → publication block → required question → warning → writing hint`。同级按 `priority` 降序、`ruleId` 字典序稳定排序。互斥规则同时命中时产生 `RULE_CONFLICT` 并阻断，不能用后写覆盖前写。条件对象禁止引用自身输出，构建时检测依赖环。`tag-index.json` 由源对象构建并校验，禁止人工编辑。每个规则必须有 golden fixture，浏览器提示与服务端裁决使用同一 evaluator。

#### ReferenceScenario

- `scenarioId`
- `neutralTitle`
- `featureTags`
- `possibleDataFields`
- `possiblePermissions`
- `possibleThirdPartyRoles`
- `possibleControls`
- `sourceReferences`
- `confidence`

对象中保留高德、百度来源用于内部追溯；面向客户的 `neutralTitle` 和提示文案不得出现竞品名称。

#### SupplementQuestion

- `questionId`
- `prompt`
- `whyAsked`
- `trigger`
- `answerType`
- `followUps`
- `writesToFactKeys`
- `sourceScenarioIds`
- `blockingLevel`
- `ownerRole`
- `dependsOnQuestionIds`
- `branches`
- `maxDepth`
- `answerWrites`
- `status`

示例：

```json
{
  "questionId": "MAP-SDK-LOCATION-01",
  "prompt": "您的产品是否接入第三方定位、地图渲染或路线规划 SDK？",
  "whyAsked": "地图类产品可能通过第三方组件处理位置、设备或网络信息，请按产品实际情况确认。",
  "answerType": "YES_NO_UNKNOWN",
  "trigger": {
    "any": [
      { "fact": "activities.navigation.enabled", "equals": true },
      { "fact": "activities.traffic.enabled", "equals": true }
    ]
  },
  "dependsOnQuestionIds": [],
  "branches": {
    "YES": {
      "answerWrites": [{ "factKey": "thirdParties.locationSdk.exists", "value": true }],
      "nextQuestionIds": ["MAP-SDK-LOCATION-DETAIL-01"]
    },
    "NO": {
      "answerWrites": [{ "factKey": "thirdParties.locationSdk.exists", "value": false }],
      "nextQuestionIds": []
    },
    "UNKNOWN": {
      "answerWrites": [],
      "nextQuestionIds": []
    }
  },
  "blockingLevel": "PUBLICATION_BLOCK",
  "ownerRole": "PRODUCT_OR_TECH",
  "status": "PUBLISHED"
}
```

子问题 `MAP-SDK-LOCATION-DETAIL-01` 声明 `dependsOnQuestionIds: ["MAP-SDK-LOCATION-01"]`，仅在父问题 `YES` 分支可达，并追问提供方、目的、字段、权限、调用条件、保存期限和隐私政策链接。

问题通过 `dependsOnQuestionIds` 构成有向无环图，`followUps` 只负责展示顺序，真实依赖以 DAG 为准。`branches` 定义 `YES/NO/UNKNOWN` 的下游问题和 `answerWrites`；答案状态为 `ACTIVE/INVALIDATED/SUPERSEDED`。是否阻断由 `blockingLevel` 和分支条件决定。用户修改上游答案后，不再可达的下游答案保留审计但标记 `INVALIDATED`，不参与事实或生成；重新可达时要求再次确认，不能静默恢复。

同一事实由多个问题写入时，值一致则合并来源，值冲突则产生 `FACT_CONFLICT`。`UNKNOWN` 自动创建指定 `ownerRole` 的待办。问题图设置最大深度和最大题数，构建时检测循环；完成条件是所有可达发布必答题都有有效答案且不存在冲突。

## 五、知识包制作流程

### 5.1 首期只整理小范围核心资料

第一期建议纳入 8 至 12 部核心文件，不把全部 354 部法规发布到运行时：

1. 《中华人民共和国个人信息保护法》；
2. 《中华人民共和国网络安全法》现行版本；
3. 《中华人民共和国数据安全法》；
4. 《网络数据安全管理条例》；
5. 《常见类型移动互联网应用程序必要个人信息范围规定》；
6. 《App违法违规收集使用个人信息行为认定方法》；
7. 《移动互联网应用程序信息服务管理规定》；
8. 《未成年人网络保护条例》；
9. 适用的个人信息安全、敏感个人信息和 App 权限相关现行标准或指南；
10. 法律团队认为地图类必须纳入的其他文件。

上述三份错配资料不得沿用错误 `lawId`。应优先使用已有官方文本；确需通过接口补齐时，执行一次精确查询并人工核对标题、机关、文号、时效性和正文后再入库。

### 5.2 清洗与审核步骤

```text
读取现有候选
  → 标题规范化
  → 按 lawId 去重
  → 校验标题、机关、文号、时效性
  → 提取相关条款
  → 建立规则与适用条件
  → 律师双人或指定负责人复核
  → Zod 校验
  → 计算内容哈希
  → 发布不可变内容包
```

自动匹配只能产生候选，不能自动获得 `VERIFIED` 状态。

### 5.3 类似产品提取表转换

高德、百度 Markdown 提取表保留为人工复核件，同时转换为精简 JSON：

- 一条业务场景一个 `ReferenceScenario`；
- 原文依据保存为内部来源索引，不进入客户页面；
- 相同场景合并为一个中性场景，保留多个来源；
- 竞品独有、与首期地图基本功能无关的场景默认不触发；
- 打车、支付、社区等会改变 App 类别的功能触发范围门禁，不直接进入地图政策；
- 提取表中的“未说明”不能转换成事实或规则。

## 六、运行时检索流程

### 6.1 第一步：把客户答案归一化为标签

例如：

```json
{
  "category": "MAP_NAVIGATION",
  "features": ["NAVIGATION", "TRAFFIC", "FAVORITES"],
  "dataClasses": ["PRECISE_LOCATION", "ROUTE_ENDPOINT", "DEVICE_INFO"],
  "permissions": ["LOCATION"],
  "thirdPartyRoles": ["LOCATION_SDK"],
  "specialFlags": ["SENSITIVE_LOCATION"],
  "unknowns": ["SDK_RETENTION", "BACKGROUND_LOCATION"]
}
```

### 6.2 第二步：确定性召回

检索器按以下顺序运行：

1. 类别基础规则；
2. 已选功能对应规则；
3. 已确认字段对应规则；
4. 敏感信息、权限、SDK、未成年人、跨境等风险规则；
5. 类似产品场景对应的补充问题；
6. 通用正式政策章节要求。

使用 `tag-index.json` 找到候选 ID，再执行 `appliesWhen` 条件。相同输入与相同内容版本必须得到相同结果。

### 6.3 第三步：动态补充问题

页面新增“补充确认”步骤，而不是只保留一个自由文本框。

问题按优先级分组：

1. **发布必答**：主体、产品范围、处理活动、字段、目的、期限、第三方、权利入口等；
2. **根据功能触发**：定位调用时机、后台定位、轨迹、收藏、搜索、语音、相机、推送等；
3. **相关产品常见但尚未确认**：SDK、Cookie、个性化推荐、跨端同步、用户内容等；
4. **自由补充**：客户仍可描述表单未覆盖的功能或数据流。

每个建议只提供：

- 中性问题；
- 为什么询问；
- `有 / 没有 / 不确定`；
- 选择“有”后的结构化追问；
- 选择“不确定”后的产品或技术待办。

系统不得默认选择“有”，也不得显示竞品名称。

前序答案必须抑制重复问题。例如客户已经确认“不接入推送 SDK”，后续不再追问具体推送厂商；如果客户选择“有”，再追问厂商、目的、字段、权限、调用条件、保存和隐私政策链接。

### 6.4 第四步：事实完整度检查

`readinessDiagnostics` 可以并存，严重度优先级为 `OUT_OF_SCOPE > KNOWLEDGE_GAP > NEEDS_CUSTOMER_INPUT/NEEDS_PRODUCT_OR_TECH > NEEDS_LEGAL_REVIEW`。`READY` 不是诊断类型，而是诊断集合为空时的派生终态：

- `NEEDS_CUSTOMER_INPUT`：客户法务仍需回答；
- `NEEDS_PRODUCT_OR_TECH`：需要产品或技术负责人确认；
- `NEEDS_LEGAL_REVIEW`：事实齐全，但法律判断待律师完成；
- `KNOWLEDGE_GAP`：本地知识包不覆盖该功能或法律问题。
- `OUT_OF_SCOPE`：涉及打车、支付、社区、多产品、跨境等首期不支持范围。

同级诊断不会因展示最高严重度而丢失，例如客户法务和技术负责人待办可以同时存在。跨境问题只用于识别范围；一旦确认涉及跨境，首期直接返回 `OUT_OF_SCOPE`，不生成跨境政策。只有 `READY` 才允许 `publicationState` 从“事实收集中”进入“待律师批准”。

`KNOWLEDGE_GAP` 不应自动触发付费查询，也不能让 DeepSeek自行判断。系统创建内部资料任务，记录问题、已选功能、已有标签、尝试过的本地规则和需要的资料类型。

| 最高优先级结果 | UI 状态 | 可生成待批准文本 | 可律师批准 | 可下载正式版 |
|---|---|---:|---:|---:|
| OUT_OF_SCOPE | 当前范围暂不支持 | 否 | 否 | 否 |
| KNOWLEDGE_GAP | 等待法律资料补充 | 否 | 否 | 否 |
| NEEDS_CUSTOMER_INPUT / NEEDS_PRODUCT_OR_TECH | 信息待补充 | 否 | 否 | 否 |
| NEEDS_LEGAL_REVIEW | 待律师判断 | 仅可预览已完成部分 | 否 | 否 |
| READY（诊断集合为空） | 可生成待批准版本 | 是 | 是 | 批准后是 |

## 七、付费接口回退机制

### 7.1 触发权限

只有律师或知识库管理员可以触发外部法规/案例查询。客户页面、DeepSeek 和普通生成接口均无权直接调用。

### 7.2 查询前先查缓存

对规范化查询参数计算 `queryHash`：

```text
hash(source + queryType + normalizedKeywords + filters + page + rows)
```

相同查询优先返回本地缓存。搜索缓存键包含数据源、规范化参数和接口版本，默认 TTL 为7天；正文存档键包含 `source + lawId + 公布/修订日期 + contentHash`，作为不可变历史版本长期保存。发生修订、时效变化、来源哈希变化或达到 `nextReviewAt` 时允许条件刷新，不以 `lawId` 永久去重。调用额度用数据库原子计数或等价事务控制，并发请求先占额度后调用，失败按计费规则决定是否返还，避免穿透日上限。

### 7.3 查询策略

查询不得再使用“关键词搜索第一条即采纳”的逻辑：

1. 优先精确标题、高级搜索、发文机关、文号和现行有效筛选；
2. 搜索只取得候选列表，不自动调用所有候选详情；
3. 先验证标题相似度、机关、文号和日期；
4. 律师选择正确候选后，再调用一次详情；
5. 详情进入候选区，结构化和审核后才能发布；
6. 搜索结果为案例或学说时，必须标注资料类型，不能当作法规效力依据。

### 7.4 成本控制

- 客户生成路径：外部查询调用次数固定为 0；
- 同一 `source + lawId + 公布/修订日期 + contentHash` 版本正文只获取一次；
- 每次知识包发布设查询预算和审批人；
- 记录接口、参数哈希、调用人、调用时间、命中数、采纳结果和成本类别；
- 不为“可能以后有用”批量获取全部正文；
- 定期更新只检查已发布核心法规的时效性和版本，不重搜整个443条目录。

首期默认硬限制：客户生成路径 0 次外查；一次知识补充任务最多 5 次搜索、2 次详情；单日最多 20 次搜索、8 次详情；达到上限后熔断并转为律师上传官方文件。具体额度可降低，调高必须记录审批人和理由。案例与学说的自动查询不属于第一期，只允许人工上传或由律师明确触发。

## 八、正式政策的多阶段生成

### 8.1 为什么不用整篇一次生成或 Multi-agent 拼接

DeepSeek 当前最大输出为 384K tokens，即 393,216 tokens，但硬上限不是目标长度。正式地图隐私政策预计约 8,000 至 20,000 个中文字符。把全部法规全文、两份竞品全文和客户数据一次送入，会增加无关信息干扰和竞品事实混入风险。

多个独立智能体逐章编写会造成术语、承诺、法律依据和客户事实不一致。第一期采用同一模型、同一事实表、固定多阶段编排。

### 8.2 生成步骤

```text
客户事实 JSON
  + 适用 LegalRule
  + 适用章节要求
  + 少量 WritingPattern
        │
        ▼
生成全局目录、定义表、主体称谓和章节事实包
        │
        ├─ 章节组一：范围、收集使用、权限、Cookie
        ├─ 章节组二：第三方、SDK、共享、保存、安全
        └─ 章节组三：权利、未成年人、更新、联系、争议、附件
        │
        ▼
全篇统一：编号、定义、称谓、交叉引用、去重
        │
        ▼
确定性验证：事实、章节、禁用表达、发布门槛
        │
        ▼
律师复核与批准
        │
        ▼
正式 Markdown + 正式 Word
```

### 8.3 发送给模型的内容

模型只接收：

- 当前项目已确认事实；
- 当前章节组需要的事实键；
- 经律师确认的适用规则摘要和条款定位；
- 当前章节所需的写作模式；
- 全局术语、主体称谓、目录和禁止事项；
- 前一阶段已经生成并冻结的必要交叉引用信息。

模型不接收：

- 354 部法规全文；
- 高德、百度完整政策全文；
- 与客户未选功能无关的提取记录；
- 未审核的搜索结果；
- 接口密钥、内部数据库对象或客户无权看到的竞品来源说明。

### 8.4 结构化中间产物

模型不能把无法可靠校验的自由 Markdown 作为权威源。每个阶段先返回 `PolicySectionArtifact`：

```json
{
  "sectionId": "collection-and-use",
  "title": "我们如何收集和使用个人信息",
  "blocks": [
    {
      "blockId": "navigation-01",
      "type": "paragraph",
      "claims": [
        {
          "claimId": "navigation-purpose-01",
          "text": "为向您提供定位和导航服务……",
          "factKeys": ["activities.navigation.purpose", "activities.navigation.fields.location"],
          "ruleIds": ["MAP-NECESSARY-INFO-01"]
        }
      ],
      "writingPatternIds": ["MAP-SCENE-DISCLOSURE-01"]
    }
  ]
}
```

Zod 校验结构、ID 和引用白名单；服务端逐 `claim` 验证 sidecar，而不是只验证段落级引用。无事实过渡句只能从已发布模板枚举中选择。Markdown 和 Word 均由同一份已验证 AST 渲染，客户版剥离内部 ID。模型不得修改姓名、公司、联系方式、日期、期限、链接、第三方名称和字段枚举等关键值；这些由模板从事实 JSON 注入。

全篇统一阶段只允许返回受限编辑操作，例如调整段落顺序、合并重复表述、统一称谓和生成过渡句。任何新增或删除 claim、事实键或规则 ID 都进入 diff gate，未经验证不得生效。

### 8.5 生成运行合同

每次生成创建 `GenerationRun`：`generationRunId`、`projectId`、`inputSnapshotHash`、`knowledgePackageHash`、`promptVersion`、`modelProvider`、`modelName`、`apiVersion`、`parameters`、`status`、`attempts`、`startedAt`、`finishedAt` 和 `errorCode`。每个章节组保存 `StageArtifact`、输入哈希、输出哈希、完成状态和重试次数。

客户端提交 `commandId + expectedProjectRevision`。短事务校验项目修订号并冻结输入，重复 `commandId` 返回原运行；模型调用不放入数据库事务。审批时再次校验 `inputSnapshotHash`，事实已修改则拒绝批准并创建新版本。单阶段最多自动重试2次，超时、截断、非法结构、引用越界和内容安全失败使用不同错误码。

`commandId` 在 `tenantId + projectId` 内唯一。运行状态为 `PENDING/RUNNING/PARTIAL_SUCCEEDED/SUCCEEDED/FAILED/CANCELLED`；阶段状态为 `PENDING/RUNNING/SUCCEEDED/RETRYABLE_FAILED/TERMINAL_FAILED/CANCELLED`。重试和续写始终复用相同输入快照，并以 `generationRunId + stageId + attempt` 标识产物；新快照必须创建新运行。一个项目同一输入哈希只允许一个活动运行，重复命令返回已有运行。批准快照还绑定 `templateHash`、`rendererVersion`、`rendererHash` 和最终 artifact hash。

允许的主状态转移为 `PENDING→RUNNING→SUCCEEDED/PARTIAL_SUCCEEDED/FAILED/CANCELLED`，`PARTIAL_SUCCEEDED→RUNNING/FAILED/CANCELLED`。`PARTIAL_SUCCEEDED`、`FAILED`、`CANCELLED` 均不可提交批准。`RETRYABLE_FAILED→RUNNING` 创建新的 attempt；已在途但被取消的模型响应允许返回服务端，但必须丢弃，不能写入当前 artifact。

### 8.6 输出长度建议

- 单个章节组：约 4,000 至 8,000 tokens；
- 全篇统一：约 24,000 至 40,000 tokens；
- 不把 `max_tokens` 设置为393,216；
- 模型因长度中断时，按章节组和版本续写，不重新生成无关章节；
- 全篇统一只能调整表达和结构，不得新增客户事实。

模型能力以实际选定 endpoint 的合同测试与压测结果为准，384K 只是当前公开上限，不作为产品可用性假设。上线前冻结每阶段字符/token预算、最大耗时、单项目成本和降级模型；全篇统一超预算时使用确定性拼接和规则化过渡句，不阻断已经合格的章节组。

## 九、正式文本验证与律师批准

### 9.1 确定性验证

待批准文本至少通过：

- 标题、目录、章节和编号完整；
- 每个客户事实陈述能映射到已确认事实；
- 每个法规性陈述能映射到已发布规则；
- 竞品案例不能单独支撑正文事实；
- 未确认字段、断言 ID、调试信息和内部来源名为 0；
- 处理活动、信息字段、目的、保存规则和第三方关系不存在冲突；
- 敏感个人信息、权限、第三方、未成年人、跨境等触发项均有对应章节；
- 正式版不含“工作草稿”“待确认”“未经律师批准”等文字；
- 待批准版和正式版正文差异可追踪。

模型可以做语言与交叉章节复核，但不能替代上述确定性检查。

### 9.2 律师批准状态机

```text
DRAFT → SUBMITTED → IN_REVIEW → CHANGES_REQUESTED → SUBMITTED
                         └──────→ APPROVED → SUPERSEDED
                                      └────→ REVOKED
```

- 客户或项目负责人提交待批准版本；
- 具备项目授权的律师可以开始复核、退回修改或批准；
- 提交人不能批准自己生成或修改的版本；
- 批准、退回和撤销均写入 append-only `ApprovalRecord`；
- 修改事实或文本不会删除旧批准，而是创建当前未批准的新版本；
- 法规或知识来源被隔离、撤销或到达 `nextReviewAt` 时创建复审任务，在律师判断前保留历史文件，但阻断基于受影响版本的新批准。

### 9.3 律师批准对象

律师批准的不是一段可变化的模型输出，而是一个冻结版本：

- 客户事实版本；
- 知识包版本与哈希；
- 模板版本；
- 模型、提示词和生成参数版本；
- Markdown 内容哈希；
- 最终 DOCX 二进制哈希与渲染预览哈希；
- 律师身份、批准时间和批准意见。

在律师批准前，服务端先用冻结渲染环境生成两个不同 artifact：客户可下载的带标识待批准版，以及客户不可下载、仅供律师预览的无水印正式候选版。律师批准的是无水印候选版的预览和 DOCX 哈希；批准动作只授予该同一二进制文件的下载权限，批准后不得重新渲染。

批准后任何事实、规则或正文修改都会生成新版本。原批准不覆盖新版本，但历史 `ApprovalRecord` 永不删除或改写。客户仍对其最终选择发布的政策及产品事实真实性负责；系统记录下载人与下载时间，不自动替客户发布。

### 9.4 知识更新与存量影响

每个来源和规则保存 `nextReviewAt`。到期、修订、废止或错配会触发影响扫描：新项目禁止使用过期包；进行中的项目提示升级；已批准政策进入复审队列并列出受影响章节。法律负责人决定继续有效、迁移到新包、重新生成或撤销当前发布版本。

复审任务状态为 `OPEN/IN_REVIEW/RESOLVED/EXPIRED`。核心法规到期前30天创建任务；到期未处理时 fail-closed，阻断新生成与新批准。错误来源进入隔离时遵循4小时阻断、1个工作日影响清单；已批准政策由律师在2个工作日内决定是否继续有效、替换或撤销。

批准被撤销后，系统禁止新的正式版下载，历史记录页显示撤销原因和替代版本，并通知项目所有者及既往下载账号；已有文件无法由系统远程收回，客户需自行替换已发布政策。历史文件仅限获授权律师和审计人员访问。

Word 渲染器固定 Node/OS 或容器版本、时区、字体、标题层级、页码、目录、超链接、附件顺序、ZIP 条目顺序和时间戳，并以 fixture 做回归。预览统一生成规范化 PDF 后计算哈希，不以浏览器截图作为批准依据。

## 十、安全要求

- 法律 MCP、DeepSeek 和其他服务密钥只允许从服务端环境变量读取；
- `法规数据/调用代码/key.md` 中的明文凭据必须迁移并轮换，不得提交远程仓库；
- 客户输入、正式政策正文和模型原始响应不得写入普通调试日志；
- 客户项目必须按 tenant 和项目授权隔离；
- 参考产品内部来源不返回客户浏览器；
- 外部查询请求不得包含客户公司名称、项目名称或未公开业务细节，只使用概括后的法律问题和筛选条件。

## 十一、第一期实施任务

### 阶段一：清理与发布首期知识包

1. 为核心法规建立白名单；
2. 清理标题错配和重复 `lawId`；
3. 提取与隐私政策披露相关的条款；
4. 将律师结论拆成 `LegalRule`；
5. 将高德、百度提取表转换为中性 `ReferenceScenario`；
6. 建立动态补充问题和条件；
7. 编写 Zod schema、fixture 和内容包校验；
8. 由法律负责人审核并发布 `map-cn-v1.0.0`。

### 阶段二：接入表单和遗漏提示

1. 将基础表单答案归一化为事实和标签；
2. 实现确定性规则匹配；
3. 新增动态“补充确认”步骤；
4. 支持有、没有、不确定及分支追问；
5. 自由补充文本先结构化为候选，再由客户逐项确认；
6. 实现事实完整度和发布阻断。

### 阶段三：正式政策生成

1. 建立全局目录和章节事实包；
2. 实现三个章节组生成；
3. 实现全篇统一与局部重试；
4. 实现正式文本确定性校验；
5. 实现待批准预览；
6. 实现律师批准和正式 Word 导出。

### 阶段四：受控外部查询

1. 建立查询缓存、`queryHash` 和审计记录；
2. 建立资料缺口任务；
3. 限制律师或知识管理员触发；
4. 搜索候选与详情获取分开；
5. 查询结果必须进入审核发布流程，禁止直接参与生成。

## 十二、成功标准

- 常规地图类项目生成过程的付费法规查询次数为 0；
- 首期所有运行时法规记录均经过人工验证，错误标题匹配为 0；
- 参考案例单独进入客户事实或正式正文的数量为 0；
- 同一输入和同一知识包版本返回相同的规则、问题和章节事实包；
- 动态补充问题能够覆盖 SDK、权限、第三方、Cookie、个性化、保存、权利、未成年人和跨境等地图类主要遗漏类型；
- 发布级事实缺失时无法生成无水印正式版；
- 正式版中的内部 ID、占位符、调试语句和竞品名称为 0；
- 每个正式文本事实能追溯到客户确认，每个法规性说明能追溯到已发布规则；
- 律师修改一个局部事实后，只重写受影响章节组，并再次执行全篇统一；
- DeepSeek 超时、截断或章节失败时不丢失客户答案，可安全重试。

## 十三、首期不做

- 不把354部法规全部建立向量索引；
- 不允许客户生成时实时调用法律接口；
- 不让 DeepSeek 自由上网查询法规或竞品政策；
- 不把高德、百度原文整篇发送给模型；
- 不自动采纳搜索结果第一条；
- 不使用多个独立智能体直接拼接正式政策；
- 不自动批准或自动发布正式政策；
- 不在第一期扩展全部39类 App。

## 十四、依赖与开放问题

### 开发前置物

- 法律团队确认首期核心法规白名单和适用条款；
- 法律团队确认高德、百度提取表中哪些场景用于地图类补充提示；
- 律师确认发布阻断字段与法律判断点；
- 产品确认“补充确认”页面的信息层级和角色分工；
- 安全负责人处理并轮换本地明文密钥。

### 尚需在工程评审锁定

- 内容包首期随服务端应用构建发布；后续若改为热加载，需单独评审签名、回滚和原子切换；
- 律师、项目负责人、知识管理员的最终角色矩阵，以及撤销通知接收人；
- 正式 Word 的具体模板资产、品牌字体授权和附件视觉表现；
- 知识包更新检查频率；
- 地图类首期核心法规的最终名单和覆盖矩阵。8至12部只是容量目标，最终准入以披露要求覆盖率为准。

## 十五、本次决策依据

- 用户明确选择“正式文本 + 律师批准门槛”；
- 用户明确要求客户看不到高德、百度资料，只看到系统根据类似产品生成的中性补充问题；
- 用户选择单模型、多阶段编排，而不是整篇一次生成或 Multi-agent 拼接；
- 用户选择版本化法规库与结构化案例库；
- 用户指出法律查询成本较高，要求优先使用已经获取的数据；
- 当前本地数据足以制作首期知识包，但搜索结果存在错配，必须先审核再使用。

## 十六、下一项真实任务

由一名律师和一名产品或技术负责人共同审阅“地图类动态补充问题清单”。使用一个真实地图 App，逐题标注：应该问谁、什么答案会触发追问、什么缺失会阻断正式版。该结果应先冻结为 `map-question-v1.0.0`，再进入代码实现。
