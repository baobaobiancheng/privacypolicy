const fs = require("node:fs");
const path = require("node:path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const outputDirectory = path.resolve(__dirname, "../../项目背景/客户演示");
const green = "173A31";
const lime = "B9FF53";
const muted = "5B6964";
const border = "B8C3BE";

const sample = {
  operator: "杭州行迹科技有限公司（演示主体）",
  product: "行迹地图（演示产品）",
  version: "Android 2.4",
  effectiveDate: "2026年8月14日",
  contact: "杭州市西湖区示例路 88 号；privacy@example.com；400-000-0000",
  rights: "App—我的—设置—隐私中心，或发送邮件至 privacy@example.com",
};

function run(text, options = {}) {
  return new TextRun({ text, font: options.font || "宋体", size: options.size || 21, bold: options.bold, color: options.color || "222222" });
}

function p(text, options = {}) {
  return new Paragraph({
    children: [run(text, options)],
    heading: options.heading,
    alignment: options.align || (options.heading ? undefined : AlignmentType.JUSTIFIED),
    spacing: { line: options.line || 360, before: options.before || 0, after: options.after ?? 140 },
    keepNext: Boolean(options.heading),
  });
}

function bullets(items) {
  return items.map((text) => new Paragraph({ children: [run(text)], bullet: { level: 0 }, spacing: { line: 340, after: 90 } }));
}

function cell(text, header = false) {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, fill: "E8EFEA" } : undefined,
    margins: { top: 110, bottom: 110, left: 120, right: 120 },
    children: [new Paragraph({ children: [run(text, { bold: header, size: 19, color: header ? green : "222222" })], spacing: { line: 290, after: 0 } })],
  });
}

function table(headers, rows, widths) {
  const allBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: border },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: border },
    left: { style: BorderStyle.SINGLE, size: 4, color: border },
    right: { style: BorderStyle.SINGLE, size: 4, color: border },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDE4E0" },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DDE4E0" },
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    columnWidths: widths,
    borders: allBorders,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((value) => cell(value, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((value) => cell(value)) })),
    ],
  });
}

function commonDocument(title, subtitle, children) {
  return new Document({
    title,
    subject: subtitle,
    creator: "隐私政策 AI 生成器",
    description: "客户沟通标准示例（演示数据）",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: "宋体", size: 21, color: "222222" }, paragraph: { spacing: { line: 360, after: 140 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "黑体", size: 38, bold: true, color: green }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } } },
        { id: "TOCHeading", name: "TOC Heading", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "黑体", size: 28, bold: true, color: green }, paragraph: { spacing: { after: 240 }, keepNext: true } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "黑体", size: 28, bold: true, color: green }, paragraph: { spacing: { before: 360, after: 180 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "黑体", size: 24, bold: true, color: "294C42" }, paragraph: { spacing: { before: 260, after: 140 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1360, right: 1260, bottom: 1360, left: 1260 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(`${title} · 客户演示`, { size: 16, color: "77827E" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("演示数据　·　第 ", { size: 16, color: "77827E" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "77827E" }), run(" 页", { size: 16, color: "77827E" })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1800, after: 260 }, children: [run(title, { font: "黑体", size: 42, bold: true, color: green })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 560 }, children: [run(subtitle, { size: 22, color: muted })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run("本文件使用虚构演示数据，仅用于说明标准输入与输出效果。", { size: 19, color: "8A5A16" })] }),
        new Paragraph({ children: [new PageBreak()] }),
        ...children,
      ],
    }],
  });
}

function buildInputDocument() {
  const children = [
    p("填写说明", { heading: HeadingLevel.HEADING_1 }),
    p("以下内容是一份能够支撑完整地图类隐私政策生成的标准输入。客户应以产品、技术和法务核实后的真实情况替换示例值；系统不会将同类产品的做法自动当作客户事实。"),
    ...bullets(["填写主体：客户公司的法务/合规人员；产品和技术负责人补充数据流、权限、SDK及保存规则。", "选择“不处理”表示该项不进入政策；不确定的内容应回到产品或技术团队核实。", "同一信息用于多个功能时，应分别说明目的、触发条件、保存期限和拒绝影响。"]),
    p("一、产品与运营主体", { heading: HeadingLevel.HEADING_1 }),
    table(["字段", "标准示例输入"], [
      ["运营主体", sample.operator], ["产品名称与版本", `${sample.product} ${sample.version}`], ["联系方式", sample.contact], ["权利请求入口", sample.rights], ["权利响应期限", "在法律规定期限内处理；复杂请求将说明延期原因"], ["政策生效日期", sample.effectiveDate], ["更新通知方式", "App 弹窗、站内消息或官网公告；重大变更再次征得同意（依法无需同意的除外）"],
    ], [2600, 6400]),
    p("二、功能边界", { heading: HeadingLevel.HEADING_1 }),
    table(["类型", "功能", "是否提供", "边界说明"], [
      ["基本功能", "定位和导航", "是", "完成定位、路线规划和导航；法定必要信息基线为位置信息、出发地、到达地"],
      ["扩展功能", "实时路况与智能交通", "是", "用户主动开启后展示道路拥堵信息，不影响基础地图浏览"],
      ["扩展功能", "浏览地图、附近与探索", "是", "用户主动浏览或点击相关内容时触发"],
      ["扩展功能", "客户服务", "是", "仅在用户发起咨询、投诉或故障反馈时触发"],
      ["扩展功能", "安全保障", "是", "用于运行安全、故障定位及防攻击，不用于个性化推荐"],
      ["扩展功能", "账号同步/个性化推荐", "否", "当前版本不提供，不写入政策正文"],
    ], [1600, 2100, 1300, 4000]),
    p("三、个人信息处理活动", { heading: HeadingLevel.HEADING_1 }),
    table(["功能/场景", "触发条件", "信息类型", "目的", "保存期限", "拒绝影响"], [
      ["定位和导航", "用户打开定位、输入起终点并启动导航", "精确位置信息、出发地、到达地", "定位、路线规划、导航与偏航重算", "行程结束后不再用于实时导航；最近路线由用户选择保留，最长30日", "无法定位或规划路线，但可浏览离线基础地图"],
      ["实时路况", "用户主动开启实时路况图层", "位置信息、道路位置、使用时间", "展示所在道路及周边拥堵情况", "实时计算完成后24小时内去标识化；聚合路况最长30日", "无法获得与当前位置相关的实时路况"],
      ["附近与探索", "用户浏览或点击附近内容", "浏览记录、点击记录、设备信息、运行日志", "展示访问历史、排查加载问题", "浏览/点击记录30日；运行日志90日", "不保存历史偏好，基础搜索仍可使用"],
      ["客户服务", "用户主动发起咨询或投诉", "联系方式、账号信息（如有）、沟通记录、用户主动提交的材料", "处理咨询、投诉、举证和结果反馈", "工单结束后180日；法律另有要求的从其规定", "可能无法核验身份或完成问题处理"],
      ["安全保障", "发生崩溃、异常访问或安全事件", "设备标识符、系统版本、IP地址、崩溃日志", "保障运行安全、定位故障、防范攻击", "运行与安全日志90日；安全事件记录依法保存", "可能无法诊断故障或保障服务安全"],
    ], [1500, 1700, 1800, 2200, 1800, 1900]),
    p("四、设备权限与控制", { heading: HeadingLevel.HEADING_1 }),
    table(["权限", "使用场景", "申请时机", "是否可关闭", "关闭影响"], [
      ["精确位置", "定位和导航、实时路况", "用户首次使用相应功能时", "可在系统设置中关闭", "无法获得当前位置相关服务"],
      ["通知", "导航提示及政策重要更新", "用户开启提醒功能时", "可以", "不影响基础导航，但无法收到后台提醒"],
      ["相机/相册/麦克风", "当前版本不使用", "不申请", "—", "—"],
    ], [1500, 2500, 2100, 1300, 2300]),
    p("五、第三方、Cookie 与跨境", { heading: HeadingLevel.HEADING_1 }),
    table(["主题", "标准示例输入"], [
      ["第三方 SDK", "当前演示版本不接入第三方 SDK；如后续接入，必须补充名称、提供方、目的、信息、触发时机和隐私政策链接"],
      ["共享/转让/公开披露", "除依法必须或另行取得必要授权外，不向第三方共享、转让或公开披露个人信息"],
      ["Cookie/同类技术", "App 端不使用 Cookie；官网仅使用维持会话所必需的 Cookie，不用于跨站广告追踪"],
      ["境外处理", "不向境外提供个人信息，服务器位于中国境内"],
    ], [2600, 6400]),
    p("六、补充事实", { heading: HeadingLevel.HEADING_1 }),
    table(["主题", "标准示例输入"], [
      ["后台定位", "导航开始后，即使用户切换至其他应用，仍可能在系统许可范围内持续获取位置以提供语音导航；导航结束或用户主动退出后停止。"],
      ["未成年人", "产品面向一般公众；不以不满14周岁未成年人为主要用户。如发现未经监护人同意收集儿童信息，将及时删除或匿名化。"],
      ["安全措施", "采取访问控制、最小权限、传输加密、日志审计、备份恢复和安全事件响应措施。"],
      ["停止运营", "通过 App 公告和站内消息提前通知，停止新增收集；主库数据按公告期限删除或匿名化，备份数据在最长90日轮换周期内清理，依法需要保存的记录除外。"],
    ], [2400, 6600]),
    p("七、提交前核对", { heading: HeadingLevel.HEADING_1 }),
    ...bullets(["公司名称、联系地址、邮箱、客服电话均可实际触达。", "功能选择与当前上线版本一致，未把规划中的功能写入。", "第三方名称、主体和链接逐项核对，不使用示例地址。", "同一处理活动的目的、期限和拒绝影响不存在矛盾。", "跨境、未成年人、敏感信息和后台定位事实已经产品/技术负责人核实。"]),
  ];
  return commonDocument("地图类隐私政策生成器｜标准输入示例", "客户填写表单与补充事实的完整样例", children);
}

function buildOutputDocument() {
  const children = [
    p("目录", { heading: "TOCHeading" }),
    new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
    p("行迹地图隐私政策", { heading: HeadingLevel.TITLE, align: AlignmentType.CENTER }),
    p(`生效日期：${sample.effectiveDate}　更新日期：${sample.effectiveDate}`, { align: AlignmentType.CENTER, color: muted, after: 300 }),
    p(`欢迎使用${sample.product}。${sample.operator}（以下简称“我们”）重视您的个人信息和隐私保护。本政策说明我们在提供${sample.version}版本服务时如何处理您的个人信息，以及您如何行使相关权利。请您在使用相应功能前阅读本政策；涉及设备权限、敏感个人信息或依法需要单独同意的处理时，我们将通过功能页面另行提示。`),
    p("一、政策说明与适用范围", { heading: HeadingLevel.HEADING_1 }),
    p(`本政策适用于${sample.operator}提供的${sample.product} ${sample.version}。如某项功能由第三方独立提供，其个人信息处理规则以该第三方依法向您提供的说明为准。`),
    p("1. 基本功能与扩展功能", { heading: HeadingLevel.HEADING_2 }),
    p("本产品的基本功能是定位和导航，完成该基本功能所需的法定必要信息基线包括位置信息、出发地和到达地。实时路况、附近与探索、客户服务、安全保障等属于扩展功能，仅在您主动使用或满足相应触发条件时处理相关信息；您拒绝扩展功能所需的信息，不影响定位和导航基本功能，但相应扩展功能可能无法使用。"),
    p("二、我们如何收集和使用个人信息", { heading: HeadingLevel.HEADING_1 }),
    p("我们按照功能场景分别处理个人信息。下表先汇总主要处理活动，随后说明触发条件和控制方式。"),
    table(["功能", "触发场景", "个人信息", "处理目的", "保存期限", "拒绝影响"], [
      ["定位和导航", "打开定位、输入起终点并启动导航", "精确位置信息、出发地、到达地", "定位、路线规划、导航与偏航重算", "实时导航结束后停止使用；用户选择保留的最近路线最长30日", "无法定位或规划路线"],
      ["实时路况", "主动开启实时路况图层", "位置信息、道路位置、使用时间", "展示所在道路及周边拥堵", "实时数据24小时内去标识化；聚合路况最长30日", "无法获得当前位置相关路况"],
      ["附近与探索", "浏览或点击附近内容", "浏览记录、点击记录、设备信息、运行日志", "展示访问历史、排查加载问题", "行为记录30日；运行日志90日", "不保存历史偏好"],
      ["客户服务", "主动咨询、投诉或提交故障", "联系方式、账号信息（如有）、沟通记录、主动提交材料", "处理工单、核验身份并反馈结果", "工单结束后180日", "可能无法完成问题处理"],
      ["安全保障", "发生崩溃、异常访问或安全事件", "设备标识符、系统版本、IP地址、崩溃日志", "故障诊断、防攻击及运行安全", "一般90日；安全事件记录依法保存", "可能影响故障诊断和安全保障"],
    ], [1400, 1500, 1800, 1900, 1800, 1800]),
    p("1. 定位和导航", { heading: HeadingLevel.HEADING_2 }),
    p("当您打开定位、输入出发地和到达地并启动导航时，我们处理精确位置信息、出发地和到达地，以完成定位、路线规划、导航播报和偏航重算。精确位置信息属于敏感个人信息，我们仅在提供上述功能所需的范围内处理，并在系统权限申请页面说明用途。您可以关闭位置权限，但关闭后我们无法确定当前位置或提供实时导航。"),
    p("导航开始后，如您切换至其他应用，我们可能在系统授权范围内继续获取位置，以维持语音导航。导航结束、您主动退出或关闭定位权限后，我们停止后台定位。"),
    p("2. 实时路况与附近探索", { heading: HeadingLevel.HEADING_2 }),
    p("当您主动开启实时路况图层时，我们处理位置信息、道路位置和使用时间，以展示所在道路及周边拥堵情况。实时计算数据将在24小时内去标识化，形成的聚合路况最长保存30日。您可以关闭路况图层；关闭不影响基础导航。"),
    p("当您浏览或点击附近内容时，我们处理浏览记录、点击记录、设备信息和运行日志，以展示访问历史并排查加载故障。浏览与点击记录保存30日，运行日志保存90日。"),
    p("3. 客户服务与安全保障", { heading: HeadingLevel.HEADING_2 }),
    p("您主动发起咨询、投诉或故障反馈时，我们根据处理工单所需收集联系方式、账号信息（如有）、沟通记录及您主动提交的材料。请勿提交与问题无关的他人信息。工单资料在结案后保存180日，法律法规另有规定的除外。"),
    p("为保障服务稳定和网络安全，我们在发生崩溃、异常访问或安全事件时处理设备标识符、系统版本、IP地址和崩溃日志，用于故障诊断、防范攻击和安全审计。一般运行与安全日志保存90日；构成安全事件的记录按照法律要求保存。"),
    p("三、设备权限、Cookie及同类技术", { heading: HeadingLevel.HEADING_1 }),
    table(["权限/技术", "用途", "申请或启用时机", "用户控制"], [
      ["精确位置", "定位、路线规划、导航及实时路况", "首次使用相应功能时申请", "可在系统设置中关闭；关闭后相关功能不可用"],
      ["通知", "导航提醒和政策重大更新通知", "用户主动开启提醒时申请", "可随时关闭，不影响基础导航"],
      ["Cookie", "App端不使用；官网仅使用维持会话所必需的Cookie", "访问官网相关页面时", "可通过浏览器管理；关闭可能影响会话保持"],
    ], [1700, 3000, 2300, 3000]),
    p("当前版本不申请相机、相册或麦克风权限。若后续版本新增相关功能，我们将在使用前更新说明并依法征得必要授权。"),
    p("四、委托处理、共享、转让、公开披露及第三方服务", { heading: HeadingLevel.HEADING_1 }),
    p("当前演示版本不接入第三方 SDK。我们不会仅因您使用本产品而向其他独立处理者提供个人信息。因业务调整确需新增第三方服务时，我们将在清单中列明服务名称、提供方、处理目的、涉及信息、启动与发送时机及隐私政策链接，并依法履行告知和授权程序。"),
    table(["第三方服务", "提供方", "目的", "涉及信息", "触发时机", "隐私政策"], [["当前无", "—", "—", "—", "—", "—"]], [1800, 1800, 1900, 1800, 1900, 1800]),
    p("未经您的单独同意，我们不会向第三方转让或公开披露您的个人信息，但法律法规另有规定的除外。发生合并、分立、重组或资产转让时，我们将告知接收方信息，并要求接收方继续受本政策约束；处理目的或方式发生变化的，将重新依法取得同意。"),
    p("五、个人信息的保存", { heading: HeadingLevel.HEADING_1 }),
    p("我们原则上在中国境内保存本政策所述个人信息，不向境外提供。各项信息的期限见第二章处理活动表；期限届满后，我们将删除或匿名化处理，法律法规要求继续保存的除外。停止运营时，我们将通过App公告和站内消息提前通知，停止新增收集，并按公告期限删除或匿名化主库数据；备份数据在最长90日轮换周期内清理。"),
    p("六、个人信息安全保护", { heading: HeadingLevel.HEADING_1 }),
    p("我们采取与风险相适应的访问控制、最小权限、传输加密、日志审计、备份恢复和安全事件响应措施。若发生或可能发生个人信息泄露、篡改或丢失，我们将立即采取补救措施，并依法告知事件类型、可能影响、已采取或拟采取的措施、您的防范建议及联系渠道；难以逐一告知时，将采取合理有效的公告方式。"),
    p("请您理解，互联网环境不存在绝对安全。我们将持续改进措施，但本段不构成超出法律规定和技术能力边界的绝对安全承诺。"),
    p("七、您的个人信息权利", { heading: HeadingLevel.HEADING_1 }),
    p(`您可通过“${sample.rights}”申请查阅、复制、更正、补充、删除个人信息，撤回同意，关闭权限，注销账号（如后续提供账号功能），或要求我们解释个人信息处理规则。我们将在核验必要身份信息后于法律规定期限内处理；复杂请求需要延期时，我们会说明原因。`),
    p("撤回同意不影响撤回前基于同意已经开展的处理。对于实现基本功能所必需或依法无需同意的处理，撤回同意可能不适用；我们会向您说明具体理由。"),
    p("八、未成年人个人信息保护", { heading: HeadingLevel.HEADING_1 }),
    p("本产品面向一般公众，不以不满14周岁未成年人为主要用户。监护人应指导未成年人使用本产品。如我们发现未经监护人同意收集了儿童个人信息，将依法及时删除或匿名化。监护人可通过本政策列明的渠道联系我们。"),
    p("九、政策更新、联系我们及适用法律", { heading: HeadingLevel.HEADING_1 }),
    p("我们可能因功能、处理规则或法律要求变化而更新本政策。重大变更将通过App弹窗、站内消息或官网公告显著提示；依法需要重新取得同意的，我们将在相关处理前征得同意。"),
    p(`运营主体：${sample.operator}。联系地址及电话：${sample.contact}。个人信息权利入口：${sample.rights}。`),
    p("本政策的订立、履行和解释适用中华人民共和国法律。对个人信息处理有疑问、意见或投诉的，您可以先联系我们；您也可以向履行个人信息保护职责的部门投诉或举报。"),
    p("附：标准输出说明", { heading: HeadingLevel.HEADING_1 }),
    p("本文件展示一份输入事实完整、结构清晰且可直接进入客户内部复核的政策文本效果。演示主体、邮箱、地址、电话、产品版本和处理活动均为虚构示例，不得未经替换直接对外发布。"),
  ];
  return commonDocument("地图类隐私政策生成器｜标准输出示例", "与《标准输入示例》逐项对应的政策 Word", children);
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const inputPath = path.join(outputDirectory, "01-地图类隐私政策生成-标准输入示例.docx");
  const outputPath = path.join(outputDirectory, "02-地图类隐私政策生成-标准输出示例.docx");
  fs.writeFileSync(inputPath, await Packer.toBuffer(buildInputDocument()));
  fs.writeFileSync(outputPath, await Packer.toBuffer(buildOutputDocument()));
  console.log(inputPath);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
