# 隐私政策 AI 生成器：方案 F 槽位驱动动态补充设计

生成日期：2026-08-14  
状态：APPROVED  
适用范围：地图导航类首期  
替代范围：替代原设计中“静态补充问卷”和“LLM 自由生成追问”的运行时方案，并纠正“三万字”为最低正文长度的错误理解。

## 一、结论

采用方案 F：**确定性题库与事实槽位决定问什么，LLM 只负责把客户自然语言抽取为结构化候选事实，以及在不改变问题含义的前提下优化追问表达。**

高德、百度资料不在客户每次填写或生成政策时整份发送给模型。其接入分为两个阶段：

1. **离线知识构建阶段**：把结构化提取表转换为中性候选场景、事实槽位、固定追问模板和抽象写作模式；
2. **项目运行阶段**：规则引擎只召回与客户已选功能和当前答案相关、且已经发布的小块结构化对象。

高德、百度的产品事实永远不能成为客户事实。客户页面不展示竞品名称，候选事项默认不选，只有客户明确回答并确认后才能参与政策生成。

## 二、需要解决的问题

现有三轮问卷可以保证一组固定主题被询问，但每题主要依赖“有/没有/不确定 + 一个详情文本框”。它存在三个问题：

1. 客户已经在详情中说明的内容，系统无法识别，后续可能重复询问；
2. 客户回答“有”但只写了一部分事实时，系统不知道具体缺少触发条件、频率、期限还是关闭入口；
3. 若直接让 LLM 决定下一题，可能漏掉法定或产品必问题、产生不可复现问题，或者把客户原文误解成法律结论。

方案 F 把“动态”限定为**根据结构化槽位缺失情况动态选择固定问题**，而不是让模型自由决定调查范围。

## 三、四层职责边界

| 层级 | 决定什么 | 可以使用什么 | 不能做什么 |
|---|---|---|---|
| 法规规则层 | 哪些主题必须覆盖、哪些缺失会阻断生成 | 已发布法规规则和披露要求 | 推断客户实际处理行为 |
| 同类场景层 | 地图产品还可能有哪些容易遗漏的功能和数据流 | 经审核的高德、百度结构化提取结果 | 证明客户具有相同功能 |
| 事实槽位层 | 一个已确认场景还缺哪些事实 | 固定槽位定义、条件和追问模板 | 生成法律结论 |
| LLM 语言层 | 从客户原文抽取候选槽位、优化固定问题表达 | 当前题目、允许槽位、客户本次回答 | 新增主题、跳过必问题、自动确认事实 |

## 四、高德、百度资料到底如何融入

### 4.1 不采用的做法

以下内容不得在每次问卷或政策生成时直接发送给 DeepSeek：

- 高德、百度完整隐私政策；
- 两份完整 Markdown 提取表；
- 与客户未选功能无关的竞品场景；
- 提取表中的原文长段落；
- 标记为“未说明”“原文未提及”的内容；
- 未经审核的 SDK、权限或第三方事实。

原因不是单纯节省 token，而是防止模型把竞品事实混入客户政策，并避免旧版本竞品政策影响当前客户文档。

### 4.2 离线转换

两份提取表作为**场景发现语料**，由离线转换任务生成四类发布对象：

```text
高德/百度提取表
  ├─ ReferenceScenario：同类产品候选场景
  ├─ FactSlotDefinition：该场景需要收集的事实槽位
  ├─ FollowUpTemplate：槽位缺失时使用的固定追问
  └─ WritingPattern：不含竞品事实的抽象表达结构
```

示例转换：

```json
{
  "scenarioId": "MAP_BACKGROUND_LOCATION",
  "neutralTitle": "后台定位",
  "customerPrompt": "产品是否会在用户未主动使用导航时持续或定时获取位置？",
  "triggerTags": ["NAVIGATION", "LOCATION"],
  "sourceRefs": [
    "REF-MAP-AMAP:location",
    "REF-MAP-BAIDU:location"
  ],
  "status": "PUBLISHED"
}
```

`sourceRefs` 仅供内部追溯。客户和生成模型看到的是 `neutralTitle`、中性问题以及事实槽位，不看到“高德这样做”“百度这样写”。

发布对象与运行时模型对象必须物理分离，禁止把 `ReferenceScenario` 直接序列化到模型请求：

```ts
type RuntimeScenarioDTO = {
  scenarioId: string;
  neutralTitle: string;
  customerPrompt: string;
  slotDefinitionIds: string[];
};

type RuntimeWritingPatternDTO = {
  patternId: string;
  sequence: string[];
};
```

运行时 DTO 严禁包含 `sourceRefs`、原文、来源 URL、网页快照路径和提取备注。发布流程必须执行 Zod 白名单校验、来源字段扫描、内容哈希和人工审核；运行时服务账号没有读取原始提取表目录的权限。系统保留实际模型请求快照，并断言 `sourceRefs / rawReferenceText / referenceUrl` 出现次数为 0。竞品名称不能由 `REFERENCE` 来源进入请求；如果客户明确填写“接入百度地图 SDK”，该名称可以作为 `CUSTOMER_TEXT` 候选，并在客户确认后作为 `CUSTOMER_CONFIRMED` 事实进入生成。

### 4.3 四类资料的不同价值

| 原始资料 | 转换后的用途 | 是否进入运行时模型输入 |
|---|---|---:|
| 法规正文及已审核规则 | 必问题、披露要求、章节约束 | 只发送适用规则摘要 |
| 高德/百度结构化提取表 | 候选场景、槽位和固定追问来源 | 不发送原表，只发送严格白名单的 Runtime DTO |
| 高德/百度完整政策 | 人工核对提取结果、观察章节组织 | 不发送全文 |
| 来源说明和网页快照 | 版本、来源和提取准确性核验 | 不发送 |
| 抽象 WritingPattern | 约束政策段落的组织方式 | 发送与当前章节匹配的少量模式 |

`WritingPattern` 只允许保存结构，不保存竞品句子。例如：

```json
{
  "patternId": "MAP-SCENE-DISCLOSURE-01",
  "sequence": [
    "使用场景",
    "触发条件",
    "个人信息类型",
    "处理目的",
    "拒绝影响",
    "保存规则",
    "用户控制方式"
  ]
}
```

这不是让模型模仿高德或百度的文字，而是告诉模型一段完整场景说明应该回答哪些问题。

## 五、事实槽位模型

### 5.1 通用槽位

每个处理场景从以下槽位中选择适用项：

- `trigger`：何时触发；
- `dataTypes`：处理哪些个人信息；
- `source`：用户提供、设备采集、第三方获得或系统产生；
- `purpose`：具体处理目的；
- `processingMethod`：收集、存储、分析、共享等处理方式；
- `permission`：涉及的设备权限及申请时机；
- `foregroundOrBackground`：前台、后台、锁屏状态；
- `frequency`：实时、持续、定时或单次；
- `retention`：保存期限及到期处理；
- `recipient`：SDK、受托方或共享接收方；
- `refusalImpact`：拒绝后的实际功能影响；
- `controlPath`：关闭、删除、撤回或查询路径；
- `sensitiveImpact`：敏感个人信息的必要性及可能影响；
- `minorHandling`：未成年人相关处理方式。

不同场景不强制填写全部槽位，由 `requiredSlotIds` 明确适用范围。

### 5.2 数据结构

```ts
type FactSlotDefinition = {
  slotId: string;
  definitionVersion: string;
  label: string;
  valueType: "TEXT" | "ENUM" | "LIST" | "BOOLEAN";
  requiredWhen: ConditionDsl;
  sourceRuleIds: string[];
  followUpTemplateIds: string[];
};

type QuestionDefinition = {
  questionId: string;
  semanticVersion: string;
  scenarioId: string;
  prompt: string;
  helpText: string;
  answerType: "YES_NO_UNKNOWN" | "SLOT_FORM";
  sourceRuleIds: string[];
  status: "PUBLISHED" | "REVOKED";
};

type FollowUpTemplateDefinition = {
  templateId: string;
  version: string;
  scenarioId: string;
  targetSlotId: string;
  priority: number;
  text: string;
  answerSchema: unknown;
  sourceRuleIds: string[];
  sourceRefs: string[];
};

type ScenarioDefinition = {
  scenarioId: string;
  questionId: string;
  requiredSlotIds: string[];
  optionalSlotIds: string[];
  appliesWhen: ConditionDsl;
  blockingLevel: "REQUIRED" | "RECOMMENDED";
  status: "CANDIDATE" | "PUBLISHED" | "FUTURE" | "REVOKED";
};

type ScenarioAnswer = {
  scenarioId: string;
  answer: "YES" | "NO" | "UNKNOWN";
  answerRevision: number;
  rawDetail: string;
  updatedAt: string;
};

type SlotValueVersion = {
  slotValueVersionId: string;
  projectId: string;
  scenarioId: string;
  slotId: string;
  value: unknown;
  rawAnswer: string;
  origin: "FORM" | "CUSTOMER_TEXT" | "LLM_EXTRACTED";
  answerRevision: number;
  slotDefinitionVersion: string;
  questionSemanticVersion: string;
  extractorVersion?: string;
  valueHash: string;
  createdAt: string;
};

type SlotAggregate = {
  projectId: string;
  scenarioId: string;
  slotId: string;
  currentVersionId?: string;
  currentStatus: "EMPTY" | "CANDIDATE" | "CUSTOMER_CONFIRMED" | "REJECTED" | "CONFLICT" | "STALE";
  confirmedAgainstRevision?: number;
  revision: number;
};

type ConflictRecord = {
  conflictId: string;
  scenarioId: string;
  slotId: string;
  answerRevision: number;
  values: unknown[];
  status: "OPEN" | "RESOLVED";
  resolution?: "KEEP_EXISTING" | "ACCEPT_CANDIDATE" | "REENTER";
};

type ConflictPredicateDefinition = {
  predicateId: string;
  version: string;
  scenarioId: string;
  expression: ConditionDsl;
  comparedSlotIds: string[];
  status: "PUBLISHED" | "REVOKED";
};
```

LLM 抽取结果永远先进入 `CANDIDATE`，不能直接成为 `CUSTOMER_CONFIRMED`。

槽位定义允许场景扩展。例如后台定位场景必须显式声明 `afterNavigation`、`screenLockedBehavior` 等场景专用槽位，不能在模型输出中临时创造字段。槽位值的逻辑定位键为 `projectId + scenarioId + slotId`，每次值变化生成新的不可变 `SlotValueVersion`；`SlotAggregate` 使用唯一 current 指针和 revision 乐观锁保存当前状态。完成检查和生成器只能读取 aggregate 指向的当前版本，不能扫描历史版本寻找任意已确认值。

### 5.3 条件 DSL

```ts
type ConditionDsl =
  | { op: "ALL" | "ANY"; conditions: ConditionDsl[] }
  | { op: "NOT"; condition: ConditionDsl }
  | { op: "EQ"; factKey: string; value: string | number | boolean }
  | { op: "IN"; factKey: string; values: Array<string | number | boolean> }
  | { op: "EXISTS"; factKey: string };

type ConditionResult = "TRUE" | "FALSE" | "UNKNOWN";
```

求值采用三值逻辑：`ALL` 中出现 `FALSE` 即为 `FALSE`，否则存在 `UNKNOWN` 为 `UNKNOWN`；`ANY` 中出现 `TRUE` 即为 `TRUE`，否则存在 `UNKNOWN` 为 `UNKNOWN`；`NOT UNKNOWN` 仍为 `UNKNOWN`。缺失键、类型不匹配和不可解析值返回 `UNKNOWN`。对于 `REQUIRED` 场景，`appliesWhen=UNKNOWN` 按失败关闭处理，激活待办并阻断生成；对于 `RECOMMENDED` 场景则展示核对提示但不阻断。发布时检查引用的 factKey、questionId、slotId 和 templateId 均存在，禁止空 `ALL/ANY`，并对问题、槽位和条件依赖图执行循环检测。

### 5.4 状态与完成语义

- `NO`：该场景不适用，场景槽位不激活；保存否定答案，但不作为政策正文事实；
- `YES`：激活 `requiredSlotIds`，只有适用的必填槽位全部确认后才完成；
- `UNKNOWN`：创建产品或技术待办，阻断该场景进入生成；
- `CANDIDATE`：可用于避免立即重复追问，但不能满足最终完成门槛；
- `CUSTOMER_CONFIRMED`：客户确认的原子单位是单个槽位值；整场景完成是所有激活必填槽位均已确认的派生状态；
- `CONFLICT`：存在矛盾值，阻断对应场景；
- `STALE`：客户原答案或槽位语义版本变化，旧确认不再适用于当前版本；
- `REJECTED`：客户拒绝该候选；在相同 `answerRevision + extractorVersion` 下不得反复抽取同一候选。

### 5.5 状态转移

| 事件 | 来源状态 | 目标状态 | 原子副作用 |
|---|---|---|---|
| LLM 抽取通过 Schema 与证据校验 | EMPTY | CANDIDATE | 写入候选版本，不解除完成阻断 |
| 客户直接填写固定字段 | EMPTY | CUSTOMER_CONFIRMED | 写入不可变值版本和确认审计 |
| 客户确认模型候选 | CANDIDATE | CUSTOMER_CONFIRMED | 绑定当前 answerRevision 并写确认审计 |
| 客户拒绝模型候选 | CANDIDATE | REJECTED | 同一答案和抽取器版本不再重复推荐 |
| 确定性冲突谓词命中 | CANDIDATE 或 CUSTOMER_CONFIRMED | CONFLICT | 同事务创建 OPEN ConflictRecord |
| 客户解决冲突并选定值 | CONFLICT | CUSTOMER_CONFIRMED | ConflictRecord 置 RESOLVED，写入新值版本 |
| 客户删除冲突相关事实 | CONFLICT | EMPTY | ConflictRecord 置 RESOLVED，清除当前活动值 |
| 依赖答案或语义版本变化 | CUSTOMER_CONFIRMED | STALE | 相关依赖、章节和生成文件同时失效 |

上述转移通过 `SlotAggregate.revision` 比较并在单个项目修订事务中完成，同时更新唯一 current 指针，记录操作者、事件、旧值版本、新值版本和时间。表单固定字段可以由客户提交直接进入 `CUSTOMER_CONFIRMED`；LLM 抽取值必须经过一次客户确认。客户答案版本变化时，旧 `CANDIDATE/REJECTED` 变为历史记录；相关 `OPEN ConflictRecord` 必须在同一事务中置为 `RESOLVED` 或由新版本替代，禁止跨 answerRevision 保持开放。

## 六、运行时问卷流程

```text
客户选择地图功能
  → 规则召回必问题和同类候选场景
  → 客户回答有/没有/不确定并填写自然语言
  → LLM按允许槽位抽取候选JSON
  → Zod校验字段、枚举和长度
  → 规则引擎计算缺失槽位和冲突
  → 从固定FollowUpTemplate选择1至3个追问
  → LLM可选地做等义改写
  → 客户查看结构化摘要并确认
  → 已确认事实进入政策生成JSON
```

### 6.1 LLM 输入

抽取阶段只发送：

- `questionId`；
- 当前中性问题；
- 允许抽取的 `slotIds` 及类型；
- 客户当前回答；
- 已确认槽位，用于避免重复抽取；
- 明确的提示注入防护指令。

不发送法规全文、竞品原文、其他项目数据或整份隐私政策。

### 6.2 LLM 输出

```json
{
  "questionId": "background-location",
  "candidateSlots": [
    {
      "slotId": "trigger",
      "value": "用户点击开始导航后",
      "evidenceText": "仅在用户点击开始导航后获取定位"
    },
    {
      "slotId": "afterNavigation",
      "value": "退出导航后停止",
      "evidenceText": "退出导航后停止"
    }
  ],
  "unparsedText": [],
  "ambiguityHints": []
}
```

模型不得输出 `missingSlots` 或最终冲突结论。`ambiguityHints` 只用于日志和人工提示，不得增加、跳过或改变任何检查。规则引擎每次都执行完整、版本化的固定冲突谓词集合，最终冲突只能由这些谓词产生。

服务端分别计算两个集合：

```text
followUpNeeded = requiredActiveSlots - confirmedSlots - validCurrentCandidates
completionBlocking = requiredActiveSlots - confirmedSlots
```

前者防止模型刚提取出候选后立即重复询问；后者决定项目是否完成。候选值即使格式有效，也不能提前解除生成阻断。

`validCurrentCandidate` 必须同时满足：`scenarioId` 一致、`answerRevision` 为当前版本、`slotDefinitionVersion` 一致、`questionSemanticVersion` 一致、通过值 Schema 校验，并且 `evidenceText` 是客户当前原文中的连续片段。否则不参与 `followUpNeeded` 计算。

### 6.3 固定追问选择

```json
{
  "templateId": "BG-LOCATION-FREQUENCY",
  "questionId": "background-location",
  "targetSlotId": "frequency",
  "text": "定位信息是实时连续获取、定时获取，还是仅在路线重新规划时获取？",
  "answerSchema": {
    "type": "enum",
    "values": ["CONTINUOUS", "INTERVAL", "ON_DEMAND", "OTHER"]
  }
}
```

LLM 即使不可用，系统仍可原样展示固定追问。因此模型超时或非法 JSON 不会降低问题覆盖，但会降低抽取便利性并增加客户手工填写量。

追问的 LLM 等义改写只能改变 `text`，不得改变 `templateId`、`targetSlotId`、`answerSchema`、选项、必填性或问题语义。首期允许直接关闭追问改写，只使用固定模板；开启前必须通过固定样例的语义一致性测试。

### 6.4 冲突处理

若客户选择“存在后台定位”，但详情写“进入后台后立即停止”，系统不得自行选择一方。规则引擎生成 `ANSWER_CONFLICT`，展示原答案和抽取结果，请客户重新确认。

以下情况禁止自动确认：

- 客户原文包含否定、条件或例外；
- 同一槽位出现两个不一致值；
- LLM 输出无法逐项引用 `evidenceText`；
- 模型输出了允许槽位之外的字段；
- 客户修改了原始回答；
- 抽取器或问题版本发生变化。

### 6.5 失效矩阵

| 变化 | 需要失效 | 不需要失效 |
|---|---|---|
| 客户修改原始回答 | 依赖该回答的候选、冲突、相关槽位确认、对应章节和当前下载文件 | 其他无依赖场景 |
| 场景从 YES 改为 NO | 该场景全部候选和确认，相关正文 | 其他场景事实 |
| 槽位 Schema 或问题语义变化 | 受影响槽位置为 STALE，重新确认 | 纯文案、标点或帮助文字变化 |
| 抽取器版本升级 | 未确认候选可重新抽取 | 已经由客户确认且语义版本未变的事实 |
| 固定追问文案等义修改 | 无 | 所有事实确认 |

失效沿显式依赖图传播。旧生成文件标记 `STALE` 并禁止再次下载；系统不能撤回用户此前已经下载到本地的副本。

依赖边使用 `DependencyEdge {fromType, fromVersionId, toType, toId}` 保存，其中答案依赖引用不可变 `answerVersionId`，事实依赖引用不可变 `slotValueVersionId`。生成产物记录 `inputRevision` 和全部 `slotValueVersionIds`；任一依赖值被替换或失效时，使用旧版本的章节与文件立即变为 `STALE`，但保留历史审计记录。

## 七、同类产品候选场景的用户体验

竞品提取表转换出的长尾场景显示为：

> 根据地图类产品常见功能，建议继续核对以下事项。

完整候选库可包含：

- 语音搜索或语音助手；
- 收藏地点、常用地址和历史路线同步；
- 用户上传照片、视频或反馈地图信息；
- 评论、路线分享或地图共建；
- 个性化排序、广告或商业消息；
- 剪贴板、运动传感器、相机或 AR；
- 车辆信息、停车助手和车辆限行提醒；
- AI 会话内容及模型优化。

每项必须明确选择“有 / 没有 / 不确定”，默认不选。选择“有”后进入对应槽位问卷；选择“没有”只保存客户的否定回答，不进入政策事实正文；选择“不确定”创建产品或技术待办。

首期客户页面只发布已经具备完整 `ScenarioDefinition + SlotDefinition + FollowUpTemplate` 的五组场景：后台定位、SDK/第三方、存储、账号同步、个性化。语音、上传分享、车辆、AI 会话等先标记为 `FUTURE`，不得展示成可进入但无法完成的问卷；后续补齐固定槽位和无模型表单后再发布。

## 八、政策生成时如何使用这些资料

生成政策时，模型收到的是：

```text
客户已确认事实JSON
+ 当前章节适用规则摘要
+ 固定章节结构
+ 与当前场景匹配的WritingPattern
+ 禁止新增事实和竞品信息的约束
```

模型不会收到高德、百度提取表。`ReferenceScenario` 也不会直接进入正文；它只能促成客户回答。只有由客户确认产生的 `SlotValue` 才能成为政策事实。

生成链路必须检查：

1. 每个具体客户事实都引用一个 `CUSTOMER_CONFIRMED` 槽位；
2. 竞品来源不能单独支撑任何正文事实；
3. 章节中的具体期限、路径、第三方名称和技术措施不得由模型补齐；
4. 修改客户回答后，相关槽位确认、生成内容和下载文件全部失效；
5. `CANDIDATE / CONFLICT / UNKNOWN / STALE / EMPTY` 均不得进入政策正文生成输入；待确认内容只显示在问卷或待办区，不进入正文。

自由 Markdown 不能单独承担事实追溯。具体客户事实不允许由模型生成任意 `text` 后再随意挂接一个槽位。生成阶段先输出受控章节对象：

```ts
type PolicyClaim = {
  claimId: string;
  claimType: "CUSTOMER_FACT" | "RULE_TEXT" | "STATIC_TEXT";
  templateId: string;
  bindings: Array<{
    placeholder: string;
    slotValueVersionId: string;
  }>;
  ruleIds: string[];
};

type PolicyClaimTemplate = {
  templateId: string;
  version: string;
  claimType: "CUSTOMER_FACT" | "RULE_TEXT" | "STATIC_TEXT";
  sectionIds: string[];
  scenarioIds: string[];
  bindingSchema: Array<{
    placeholder: string;
    allowedSlotIds: string[];
    valueType: "TEXT" | "ENUM" | "LIST" | "BOOLEAN";
    required: boolean;
  }>;
  allowedRuleIds: string[];
  templateText: string;
};

type PolicySectionArtifact = {
  sectionId: string;
  claims: PolicyClaim[];
};
```

`PolicySectionArtifact` 是生成服务唯一接受的模型输出；除 `claims` 及其顺序外出现任何自由文本字段都拒绝。`CUSTOMER_FACT` 必须使用已发布模板，并把每个事实占位符绑定到当前版本的 `CUSTOMER_CONFIRMED` 槽位值；绑定集合必须与 `bindingSchema` 精确匹配，slot、valueType、section、scenario 和 rule 均须符合模板约束。`RULE_TEXT` 只能引用当前章节适用的已发布 `ruleIds`，`STATIC_TEXT` 只能选择已发布且无客户事实占位符的固定模板。连接语也必须建模为 `STATIC_TEXT`，LLM只能选择和排序已发布 claim，不能输出模板之外的解释。服务端校验后再渲染 Markdown 和 Word。竞品关键词扫描只作为纵深防御，不能代替模板绑定和 claim 类型校验。

## 九、三万字和输出上限的正确设计

真实需求是：**支持约三万中文字符的完整政策输出，不能因为 `max_tokens` 设置过小而被截断。**它不是要求每份政策正文必须达到三万字。

因此：

- `DEEPSEEK_MAX_TOKENS` 默认保留为 `65,536`，不得低于能够容纳约三万中文字符的压测值；
- 不设置 `POLICY_MIN_VISIBLE_CHARACTERS=30000` 这类最低字数门槛；
- 删除“字数不足就扩写凑到三万字”的逻辑；
- 保留 Markdown 最大长度，例如允许不低于 120,000 字符；
- `finish_reason=length`、缺章、Markdown 未闭合或服务端响应被截断时判定生成失败；
- 优先按章节组生成并合并，单个章节组失败时只重试该组；
- 字数只作为异常监控指标，不作为政策质量或合规完整度指标。

`65,536` 是初始配置而不是未经验证的保证。上线前必须用实际 DeepSeek 模型、API 版本和网关完成中文字符/token比例、请求时长、响应体大小及 `finish_reason` 压测。章节组生成使用固定顺序和幂等 `generationRunId + sectionGroupId`，失败只重试同一输入版本的章节组；合并后执行跨章术语、重复 claim、编号和章节完整性校验。

政策质量由章节覆盖、事实槽位覆盖、来源边界和一致性决定，而不是由篇幅决定。

## 十、失败与降级

| 失败情况 | 用户结果 | 系统行为 |
|---|---|---|
| LLM 抽取超时 | 仍可继续填写 | 展示固定槽位表单，不丢失原答案 |
| LLM 返回非法 JSON | 仍可继续填写 | 丢弃抽取结果并记录错误码 |
| 抽取到未知槽位 | 不展示未知内容 | 丢弃并记录越界输出 |
| 抽取与原答案冲突 | 要求客户确认 | 进入 `ANSWER_CONFLICT` |
| 追问改写失败 | 展示固定问题 | 不影响覆盖和完成状态 |
| 政策生成被截断 | 不提供下载 | 保留输入并重试失败章节组 |
| 竞品内容出现在正文 | 不提供下载 | 返回 `REFERENCE_FACT_LEAK` |

## 十一、首期实施边界

首期实现：

1. 地图类场景目录和事实槽位 Schema；
2. 高德、百度提取表离线转换后的中性 `ReferenceScenario`；
3. 17 个现有基础问题的槽位化；
4. 后台定位、SDK、存储、账号同步、个性化五组固定分支追问；
5. DeepSeek 结构化抽取接口与 Zod 校验；
6. 缺失槽位计算、冲突处理和客户确认摘要；
7. LLM 失败时的固定表单降级；
8. 政策生成只读取客户确认槽位；
9. 输出 token 上限和截断检测修正。

首期不实现：

- LLM 自由创建新的合规主题；
- LLM 决定某个必问题是否跳过；
- 运行时读取完整竞品政策或提取表；
- 自动把新发现的竞品场景发布到客户问卷；
- 把 LLM 缺失检测当作完成性证明；
- 律师审批工作流。客户公司法务和产品、技术人员补充事实后即可获得草稿。

## 十二、成功标准

- 相同表单、问题包版本和模型抽取结果产生相同的固定追问集合；追问按 `priority, scenarioId, slotId, templateId` 稳定排序，每批最多展示 3 个，客户回答或确认后重新计算下一批，直到集合为空；
- 关闭 DeepSeek 后，所有必问题和追问仍可通过固定表单完成；
- 客户已经明确写出的事实不再被重复询问；
- 每个追问都能映射到 `questionId + targetSlotId` 以及至少一个内部来源引用；法规必问题使用 `sourceRuleIds`，同类场景发现题可在发布对象中关联 `sourceRefs`，但 `sourceRefs` 不进入 Runtime DTO；
- LLM 输出允许槽位之外字段的采纳数量为 0；
- 竞品事实单独进入客户事实或政策正文的数量为 0；
- “未说明”被转换为“没有处理”的数量为 0；
- 模型输出被截断时不生成 Word；
- 不再因正文不足三万字而扩写或拒绝生成；
- 客户修改原答案后，相关候选槽位和生成文件全部失效。
- 项目生成阻断集合定义为：所有 `blockingLevel=REQUIRED` 且当前适用场景中的 `completionBlocking`，以及这些场景中的 `UNKNOWN / CONFLICT / STALE`。集合非空时不允许生成草稿；`RECOMMENDED` 场景未完成只显示提示，不阻断生成；
- 生成草稿不以律师、客户法务签批为前置条件，客户法务只是可选的事实填写参与者，不是系统审批角色；
- 首期页面展示的每个候选场景都能在关闭 LLM 时完成全部固定追问；
- 实际模型请求中由 `REFERENCE` 来源注入的竞品名称、来源引用、URL和原文片段数量为 0；客户明确填写并确认的第三方产品名称不受此限制。

## 十三、实施顺序

1. 冻结地图类 `Scenario/Slot/FollowUpTemplate` Schema；
   同时冻结 `QuestionDefinition`、三值 `ConditionDsl`、`ConflictPredicateDefinition` 和 `PolicyClaimTemplate`；
2. 将现有 17 个问题映射为场景和槽位；
3. 从高德、百度提取表生成候选场景清单，人工排除竞品独有和超范围功能；
4. 先实现纯规则槽位问卷和缺失计算；
5. 接入 DeepSeek 槽位抽取，但保持可完全关闭；
6. 增加客户确认摘要和冲突处理；
7. 改造生成输入为确认槽位 JSON；
8. 删除三万字最低门槛，保留 65,536 token 输出预算和截断校验；
9. 用地图类填写示例跑通无模型、正常模型、非法 JSON、模型超时和截断五条流程。

## 十四、对现有方案的最终取舍

- A 纯静态题库保留为降级路径；
- E 规则增强成为覆盖基础；
- C 的 LLM 追问收紧为“结构化槽位抽取 + 固定追问等义改写”；
- D 缺失检测只作为离线题库质检，不作为客户项目的完成闸门；
- 上一条所指的是 LLM 或竞品对照式缺失检测；确定性规则的 `completionBlocking` 仍是生成闸门；
- B 纯 LLM 动态出题明确排除。

方案 F 的核心不是“让 AI 多问几句”，而是让客户少回答重复问题，同时让每一项缺失都由可审计规则发现。
