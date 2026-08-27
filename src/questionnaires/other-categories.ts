import {
  REGULATION_SOURCE,
  buildQuestionnaire,
  commonPartnerInformation,
  feature,
  field,
  type AppQuestionnaire,
} from "./shared";

export const OTHER_CATEGORY_KEYS = [
  "instant-messaging", "online-community", "dating", "remote-meeting", "live-streaming", "online-av", "short-video", "news",
  "online-payment", "online-shopping", "food-delivery", "mail-express", "housing", "used-car",
  "recruitment", "online-lending", "investment", "mobile-banking",
  "medical-registration", "online-game", "education", "womens-health", "fitness", "ebook",
  "mail-cloud", "browser", "input-method", "security-management", "camera-beauty", "app-store", "practical-tools",
] as const;

export type OtherCategoryKey = (typeof OTHER_CATEGORY_KEYS)[number];

const hashes: Record<OtherCategoryKey, string> = {
  "instant-messaging": "62c57100af29029e625675d6dc7715c7c539a62a3f35ea8cc67b62dd6e6eeaa7",
  "online-community": "a8781673f1159bd0262c61a4211ef0010998621fd10a1d3f738f83d2df61f37f",
  dating: "7075159cef1791ab687d71fab1008d6a9adfca696a923a4996eed6d7e59bedde",
  "remote-meeting": "1393b4f8ff6bc8769099275baaf0531a9e53b3891ee57930635456f581e559f6",
  "live-streaming": "bbafa4b092a5d2431c3cd44ca35c29888e7b2d0efccba0a975d3010b1846a374",
  "online-av": "f941dc6bbadbcb462ae96967dc6b4952f15e159973b6894a81778716f9a4a8d3",
  "short-video": "9d4059799f43952208651e5a5483e325673b40db21bf743fb115776e4e162093",
  news: "2de8300991b2bb0d205349895bd38cb1bfda1498f3194756bc30124062f42a8e",
  "online-payment": "7554f97e8eac8686d9aceba27cd383d5669dfdfb7ccbff4b0bc8157b94012d1d",
  "online-shopping": "e3dc6e2da1503b3ee78b14043166ec82be317ab915698f7320ddf07b1666ee09",
  "food-delivery": "3878849b48978ea3b01e7b1e35c45df47fff6e1c4d8985f054875184a0b9e118",
  "mail-express": "919f12dea2b87d60956ed9aaa639ba2757e94f050071b12fd5135a1d9415769b",
  housing: "3e57625f9008bfbb1f2d010025bf338ffb288f4e43374b116ca404cc76d28db6",
  "used-car": "f19cd56f3c0afa324b33707f575ce23e9c5b08490712cd5d82319361510ffbc0",
  recruitment: "9a6ce628993cf138d108757ecbfa06172faf22b61b12d32e333195c2d683f7df",
  "online-lending": "f495c8f63c4538d2525b1ecb89f14126aeb75acedd93bceda7141b2f3714ce84",
  investment: "5acd82aac8f5e6f6f9c6f2d2cd29f538198caba1a2791eb89aac72f03ed26f64",
  "mobile-banking": "b582f3e1c97f03ee7fa7a414a35ecdf319f8472f125097756c0fa2111f4d40f5",
  "medical-registration": "2b7400134e200beb6f418f216d4c7cf347fdac166dc85e9712ec71ca3339ae6f",
  "online-game": "835e219a1644b3032e35a5569092385f0c8dc02cba9583693178661b04ea8773",
  education: "3d72828a41c5f0cf848a7eeb413ece4fc78203aae1cfb17ade229a80bfafe4ec",
  "womens-health": "3f7a5a58ae1c0f2bb2c4b9f004fb5e1541df13e48d4b4bccbf58f5fa363f7b74",
  fitness: "4625b41d15d3ae1ea45e0659d2cdee071fc23b31c7e8670d1b71f97524661ab4",
  ebook: "e817af9553d053d4c553a5616b44acdef015caaae4d13c32a50457019ff803c0",
  "mail-cloud": "e4798c621002971dd6ed5ca30b9337810c8fe3813c800784df0ffd7ebb43e154",
  browser: "9b55579ee653121f1d5ac6ec6196a9ce6398396a0bf903e0cf558a3b1b28ae25",
  "input-method": "88fa0076edc4cc85546a8ac3ab74fc13068b17b4b0fa3e532462f0bd2dc92e6c",
  "security-management": "0157b474a214efa0c48739035308f2b0a6e5685786562dc522b0f9bd24e7ba1c",
  "camera-beauty": "88e910f8a5bb049dba8bd3e832c1810f5f92f75df84504d76b2d90b6b8b92203",
  "app-store": "cdf8e8bc3c41bc477da0c27f268935e652df3f7768f30ce5de8199e9d8abd128",
  "practical-tools": "666ca604e6a781e8626dddca12b57e2053618729fef48152f5c70328e268289d",
};

const q = (
  categoryKey: OtherCategoryKey,
  features: AppQuestionnaire["features"],
  options: Parameters<typeof buildQuestionnaire>[3] = {},
) => buildQuestionnaire(categoryKey, hashes[categoryKey], features, {
  contentVersion: `universal-v1.${categoryKey}`,
  ...options,
});

export const otherQuestionnaires: Record<OtherCategoryKey, AppQuestionnaire> = {
  "instant-messaging": q("instant-messaging", [
    feature("im-account", "账号注册与联系人", "BASIC", "注册即时通信账号并维护联系人", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "即时通信账号", true, REGULATION_SOURCE), field("contacts", "即时通信联系人账号列表", true, REGULATION_SOURCE)], ["注册和登录账号", "展示联系人列表", "建立通信关系"]),
    feature("im-message", "消息发送与接收", "BASIC", "发送和接收文字、图片、语音或视频消息", [field("message-content", "通信内容"), field("recipient", "消息接收方"), field("message-time", "消息时间"), field("delivery-status", "送达和已读状态")], ["发送和接收即时消息", "展示消息状态", "同步聊天记录"]),
    feature("im-call", "音视频通话", "EXTENSION", "发起实时语音或视频通话", [field("voice-video", "音视频内容"), field("call-record", "通话记录"), field("device-network", "设备和网络信息")], ["建立音视频通话", "保障通话质量", "记录通话状态"]),
    feature("im-group", "群组与互动", "EXTENSION", "创建群组并进行多人互动", [field("group-info", "群组信息"), field("member-list", "群成员列表"), field("interaction", "群互动记录")], ["创建和管理群组", "展示群成员", "处理群互动"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "contacts", "notifications", "clipboard"], partnerPurposes: ["登录", "音视频通信", "消息推送", "内容存储", "安全风控", "客服"] }),

  "online-community": q("online-community", [
    feature("community-account", "账号注册", "BASIC", "注册社区账号并维护个人主页", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("nickname", "昵称和头像"), field("profile", "个人主页信息")], ["注册和登录账号", "展示个人主页", "识别内容发布者"]),
    feature("community-publish", "内容发布与展示", "BASIC", "发布话题、帖子、图片或视频", [field("published-content", "用户发布的内容"), field("media", "用户上传的图片或视频"), field("publish-time", "发布时间")], ["发布和展示内容", "保存用户草稿", "进行内容管理"]),
    feature("community-interact", "关注与互动", "BASIC", "评论、点赞、收藏、关注或私信", [field("interaction", "评论、点赞和收藏记录"), field("following", "关注关系"), field("private-message", "私信内容")], ["完成社区互动", "展示关注关系", "发送互动通知"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "contacts", "notifications", "location"] }),

  dating: q("dating", [
    feature("dating-account", "账号注册", "BASIC", "注册婚恋相亲账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "核验账号状态"]),
    feature("dating-profile", "婚恋资料展示", "BASIC", "填写并展示用于相亲匹配的个人资料", [field("gender", "性别", true, REGULATION_SOURCE), field("age", "年龄", true, REGULATION_SOURCE), field("marital-status", "婚姻状况", true, REGULATION_SOURCE), field("nickname-photo", "昵称和照片"), field("self-introduction", "自我介绍")], ["建立和展示婚恋资料", "提供资料筛选", "完成相亲匹配"]),
    feature("dating-match", "推荐与匹配", "BASIC", "根据用户设置的条件查找或推荐对象", [field("match-preference", "匹配条件和偏好"), field("location", "所在地区或位置信息"), field("view-interaction", "浏览和互动记录")], ["筛选和推荐匹配对象", "展示附近用户", "优化匹配结果"]),
    feature("dating-chat", "沟通与邀约", "EXTENSION", "与匹配对象进行文字或音视频沟通", [field("chat-content", "沟通内容"), field("call-record", "音视频通话记录"), field("report-material", "投诉举报材料")], ["提供沟通服务", "处理邀约和通知", "处理投诉举报"]),
  ], { permissionKeys: ["location", "camera", "microphone", "photos", "notifications"] }),

  "remote-meeting": q("remote-meeting", [
    feature("meeting-account", "账号注册", "BASIC", "注册会议账号并维护参会身份", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("display-name", "参会显示名称")], ["注册和登录账号", "展示参会身份"]),
    feature("meeting-join", "创建与加入会议", "BASIC", "创建会议或通过会议信息加入会议", [field("meeting-info", "会议号、链接和密码"), field("participant", "参会人和参会记录"), field("meeting-time", "会议时间")], ["创建和加入会议", "展示参会人员", "发送会议提醒"]),
    feature("meeting-av", "音视频会议", "BASIC", "在会议中传输音频、视频和共享内容", [field("audio-video", "音视频内容"), field("shared-content", "屏幕或文件共享内容"), field("device-network", "设备和网络信息")], ["提供实时音视频会议", "传输共享内容", "保障会议质量"]),
    feature("meeting-record", "录制与会议纪要", "EXTENSION", "在用户明确操作后录制会议或生成纪要", [field("recording", "会议录音录像"), field("transcript", "转写文本和会议纪要")], ["保存会议录制", "生成转写和会议纪要", "提供录制文件下载"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "notifications", "clipboard"] }),

  "live-streaming": q("live-streaming", [
    feature("live-browse", "直播浏览与搜索", "BASIC", "浏览、搜索和播放实时直播内容", [field("search-record", "搜索记录"), field("view-record", "观看记录"), field("device-network", "设备和网络信息")], ["展示和播放直播内容", "提供搜索和分类", "保障播放质量"]),
    feature("live-interact", "评论、关注与打赏", "EXTENSION", "登录后进行评论、关注、送礼或打赏", [field("account", "账号信息"), field("comment", "评论和互动内容"), field("follow", "关注记录"), field("gift-payment", "礼物和支付信息")], ["完成直播互动", "管理关注关系", "完成虚拟礼物或打赏"]),
    feature("live-publish", "开播与内容发布", "EXTENSION", "申请开播并发布实时音视频内容", [field("identity", "主播身份信息"), field("live-content", "直播音视频内容"), field("location", "开播位置"), field("moderation", "审核和违规记录")], ["核验开播资格", "发布直播内容", "进行内容安全管理"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "notifications", "location"], partnerPurposes: ["直播分发", "内容审核", "支付", "消息推送", "统计分析", "安全风控"] }),

  "online-av": q("online-av", [
    feature("av-search-play", "音视频搜索与播放", "BASIC", "搜索和播放影视、音乐等音视频内容", [field("search-record", "搜索记录"), field("play-record", "播放记录"), field("device-network", "设备和网络信息")], ["提供搜索和播放", "记录播放进度", "保障播放质量"]),
    feature("av-favorite", "收藏、下载与播放记录", "EXTENSION", "收藏内容、离线下载或跨设备同步进度", [field("favorite", "收藏记录"), field("download", "下载记录"), field("play-progress", "播放进度")], ["保存收藏和播放进度", "提供离线播放", "跨设备同步记录"]),
    feature("av-subscription", "会员订阅与购买", "EXTENSION", "开通会员或购买数字内容", [field("account", "账号信息"), field("subscription", "会员和订阅信息"), field("payment", "支付信息")], ["开通会员权益", "完成内容购买", "处理退款和对账"]),
  ], { permissionKeys: ["photos", "notifications", "microphone"] }),

  "short-video": q("short-video", [
    feature("short-search-play", "短视频搜索与播放", "BASIC", "搜索、浏览和播放短视频", [field("search-record", "搜索记录"), field("play-record", "播放记录"), field("device-network", "设备和网络信息")], ["提供搜索和播放", "记录播放进度", "保障播放质量"]),
    feature("short-interact", "点赞、评论与关注", "EXTENSION", "登录后进行点赞、评论、收藏或关注", [field("account", "账号信息"), field("interaction", "点赞、评论和收藏记录"), field("following", "关注关系")], ["完成内容互动", "管理关注关系", "发送互动通知"]),
    feature("short-publish", "拍摄与发布", "EXTENSION", "拍摄、编辑并发布短视频", [field("video-content", "用户拍摄和上传的视频"), field("draft", "视频草稿"), field("location", "发布位置"), field("moderation", "审核和违规记录")], ["拍摄和编辑视频", "发布用户内容", "进行内容安全管理"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "location", "notifications"] }),

  news: q("news", [
    feature("news-browse-search", "新闻浏览与搜索", "BASIC", "浏览、搜索和阅读新闻资讯", [field("search-record", "搜索记录"), field("read-record", "阅读记录"), field("device-network", "设备和网络信息")], ["展示新闻资讯", "提供搜索和分类", "记录阅读进度"]),
    feature("news-subscribe", "订阅、收藏与评论", "EXTENSION", "登录后订阅频道、收藏或评论", [field("account", "账号信息"), field("subscription", "订阅和收藏记录"), field("comment", "评论内容")], ["保存订阅和收藏", "完成评论互动", "发送资讯更新提醒"]),
  ], { permissionKeys: ["notifications", "photos", "location"] }),

  "online-payment": q("online-payment", [
    feature("payment-account", "支付账号与实名认证", "BASIC", "注册支付账号并完成身份核验和银行卡绑定", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("name", "注册用户姓名", true, REGULATION_SOURCE), field("document-type-number", "证件类型和号码", true, REGULATION_SOURCE), field("document-validity", "证件有效期限", true, REGULATION_SOURCE), field("bank-card", "银行卡号码", true, REGULATION_SOURCE)], ["注册和登录支付账号", "完成实名身份核验", "绑定银行卡"]),
    feature("payment-transaction", "支付、提现与转账", "BASIC", "完成支付、提现或转账交易", [field("transaction", "交易订单和流水信息"), field("payee", "收付款方信息"), field("amount-time", "交易金额和时间"), field("channel", "交易渠道")], ["发起和完成交易", "处理提现或转账", "展示交易记录"]),
    feature("payment-risk", "交易安全与争议处理", "EXTENSION", "识别异常交易并处理退款、申诉或争议", [field("device-network", "设备和网络信息"), field("risk-record", "风险识别记录"), field("appeal", "申诉和争议材料")], ["保障账户和交易安全", "识别异常交易", "处理退款和争议"]),
  ], { permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurposes: ["身份核验", "银行卡验证", "支付清算", "安全风控", "客服"], partnerInformation: ["身份信息", "银行卡信息", "交易信息", "设备和网络信息", "联系方式"] }),

  "online-shopping": q("online-shopping", [
    feature("shopping-account", "账号注册", "BASIC", "注册购物账号并接收订单通知", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "管理购物订单"]),
    feature("shopping-browse", "商品浏览与搜索", "BASIC", "浏览、搜索和筛选商品", [field("search-view", "搜索和浏览记录"), field("favorite", "收藏和购物车信息")], ["展示和搜索商品", "保存收藏和购物车", "展示最近浏览"]),
    feature("shopping-order", "下单与配送", "BASIC", "提交商品订单并完成配送", [field("recipient", "收货人姓名（名称）", true, REGULATION_SOURCE), field("address", "收货地址", true, REGULATION_SOURCE), field("contact", "收货人联系电话", true, REGULATION_SOURCE), field("order", "商品和订单信息")], ["创建和履行订单", "联系收货人", "完成商品配送"]),
    feature("shopping-payment", "支付与退款", "BASIC", "完成订单支付、退款和对账", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE), field("invoice", "发票信息")], ["完成订单支付", "处理退款和对账", "开具发票"]),
  ], { permissionKeys: ["location", "camera", "photos", "notifications", "clipboard"], partnerPurposes: ["登录", "订单支付", "商品配送", "消息推送", "统计分析", "客服"] }),

  "food-delivery": q("food-delivery", [
    feature("food-account", "账号注册", "BASIC", "注册外卖账号并接收订单通知", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "管理外卖订单"]),
    feature("food-browse", "餐饮浏览与搜索", "BASIC", "浏览和搜索商家、餐品或附近服务", [field("location", "位置或所在城市"), field("search-view", "搜索和浏览记录"), field("preference", "口味和配送偏好")], ["展示附近餐饮服务", "搜索和筛选餐品", "展示最近浏览"]),
    feature("food-order", "下单与配送", "BASIC", "提交餐饮订单并配送到指定地点", [field("recipient", "收货人姓名（名称）", true, REGULATION_SOURCE), field("address", "收货地址", true, REGULATION_SOURCE), field("contact", "收货人联系电话", true, REGULATION_SOURCE), field("order", "餐品和订单信息")], ["创建和履行餐饮订单", "联系收货人", "完成餐饮配送"]),
    feature("food-payment", "支付与退款", "BASIC", "完成订单支付、退款和对账", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE)], ["完成订单支付", "处理退款和对账"]),
  ], { permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurposes: ["地图定位", "订单支付", "餐饮配送", "消息推送", "统计分析", "客服"] }),

  "mail-express": q("mail-express", [
    feature("express-sender", "寄件人信息", "BASIC", "填写寄件人身份、地址和联系方式", [field("sender-name", "寄件人姓名", true, REGULATION_SOURCE), field("sender-document", "寄件人证件类型和号码等身份信息", true, REGULATION_SOURCE), field("sender-address", "寄件人地址", true, REGULATION_SOURCE), field("sender-contact", "寄件人联系电话", true, REGULATION_SOURCE)], ["核验寄件人身份", "联系寄件人", "安排上门取件"]),
    feature("express-recipient", "收件人与物品信息", "BASIC", "填写收件人及寄递物品信息", [field("recipient-name", "收件人姓名（名称）", true, REGULATION_SOURCE), field("recipient-address", "收件人地址", true, REGULATION_SOURCE), field("recipient-contact", "收件人联系电话", true, REGULATION_SOURCE), field("item-name", "寄递物品名称", true, REGULATION_SOURCE), field("item-nature", "寄递物品性质", true, REGULATION_SOURCE), field("item-quantity", "寄递物品数量", true, REGULATION_SOURCE)], ["创建寄递订单", "联系收件人", "完成实名收寄和安全检查"]),
    feature("express-tracking", "物流跟踪与签收", "BASIC", "查询邮件快件运输和签收状态", [field("tracking", "运单号和物流轨迹"), field("sign-record", "签收记录"), field("exception", "异常处理记录")], ["展示物流进度", "完成派送和签收", "处理物流异常"]),
    feature("express-payment", "运费支付与开票", "EXTENSION", "完成运费支付、退款和开票", [field("payment", "支付信息"), field("invoice", "发票信息")], ["完成运费支付", "处理退款", "开具发票"]),
  ], { permissionKeys: ["location", "camera", "photos", "contacts", "notifications"] }),

  housing: q("housing", [
    feature("housing-account", "账号注册", "BASIC", "注册房屋租售账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "识别房源发布者或咨询者"]),
    feature("housing-publish", "房源发布", "BASIC", "发布出租或出售的个人房源", [field("house-address", "房屋地址", true, REGULATION_SOURCE), field("area-layout", "房屋面积和户型", true, REGULATION_SOURCE), field("expected-price", "期望售价或租金", true, REGULATION_SOURCE), field("house-media", "房源图片和视频"), field("publisher-contact", "发布者联系方式")], ["发布和展示房源", "完成房源信息管理", "联系房源发布者"]),
    feature("housing-search", "房源查询与咨询", "BASIC", "搜索、筛选、收藏并咨询房源", [field("search-record", "搜索和浏览记录"), field("location", "目标区域或位置信息"), field("favorite", "收藏记录"), field("communication", "咨询沟通记录")], ["搜索和筛选房源", "保存收藏", "完成房源咨询"]),
  ], { permissionKeys: ["location", "camera", "photos", "notifications"] }),

  "used-car": q("used-car", [
    feature("car-account", "账号注册", "BASIC", "注册二手车交易账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "识别交易参与方"]),
    feature("car-buyer", "购买方信息", "BASIC", "填写二手车购买方身份信息", [field("buyer-name", "购买方姓名", true, REGULATION_SOURCE), field("buyer-document", "购买方证件类型和号码", true, REGULATION_SOURCE), field("buyer-contact", "购买方联系方式")], ["核验购买方身份", "联系购买方", "办理车辆交易"]),
    feature("car-seller", "出售方与车辆信息", "BASIC", "填写出售方身份和车辆权属信息", [field("seller-name", "出售方姓名", true, REGULATION_SOURCE), field("seller-document", "出售方证件类型和号码", true, REGULATION_SOURCE), field("vehicle-license", "车辆行驶证号", true, REGULATION_SOURCE), field("vin", "车辆识别号码", true, REGULATION_SOURCE), field("vehicle-media", "车辆图片和检测材料")], ["核验出售方和车辆信息", "发布二手车信息", "办理车辆交易"]),
    feature("car-contact", "咨询、预约与交易", "EXTENSION", "咨询车辆、预约看车或提交交易意向", [field("communication", "沟通记录"), field("appointment", "预约看车信息"), field("order-payment", "订单和支付信息")], ["完成车辆咨询", "安排看车", "处理交易订单"]),
  ], { permissionKeys: ["camera", "photos", "location", "notifications"] }),

  recruitment: q("recruitment", [
    feature("job-account", "账号注册", "BASIC", "注册求职招聘账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "识别求职者或招聘方"]),
    feature("job-resume", "简历创建与投递", "BASIC", "创建、维护和投递求职简历", [field("resume", "求职者提供的简历", true, REGULATION_SOURCE), field("job-preference", "求职意向"), field("delivery-record", "简历投递记录")], ["创建和展示简历", "投递职位", "进行职位匹配"]),
    feature("job-search", "职位搜索与沟通", "BASIC", "搜索职位并与招聘方沟通", [field("search-record", "职位搜索和浏览记录"), field("communication", "求职沟通记录"), field("interview", "面试安排")], ["搜索和推荐职位", "完成招聘沟通", "安排面试"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "location", "notifications"] }),

  "online-lending": q("online-lending", [
    feature("loan-account", "账号与贷款申请人身份", "BASIC", "注册账号并核验借款人身份和收款账户", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("borrower-name", "借款人姓名", true, REGULATION_SOURCE), field("document-type-number", "证件类型和号码", true, REGULATION_SOURCE), field("document-validity", "证件有效期限", true, REGULATION_SOURCE), field("bank-card", "银行卡号码", true, REGULATION_SOURCE)], ["注册和登录账号", "核验借款人身份", "绑定放款和还款账户"]),
    feature("loan-application", "贷款申请与评估", "BASIC", "提交贷款申请并进行资格和风险评估", [field("loan-request", "借款金额、期限和用途"), field("employment-income", "职业和收入信息"), field("credit-info", "依法取得的信用信息"), field("contact", "联系信息")], ["受理个人贷款申请", "进行资格和风险评估", "形成授信或审批结果"]),
    feature("loan-contract", "合同、放款与还款", "BASIC", "签署借款合同并完成放款和还款管理", [field("contract", "借款合同信息"), field("disbursement", "放款信息"), field("repayment", "还款和逾期记录")], ["签署和履行借款合同", "完成放款", "管理还款和逾期"]),
  ], { permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurposes: ["身份核验", "银行卡验证", "信用评估", "电子签约", "支付清算", "安全风控"], partnerInformation: ["身份信息", "银行卡信息", "贷款申请信息", "信用信息", "设备和网络信息"] }),

  investment: q("investment", [
    feature("invest-account", "账号与投资者身份", "BASIC", "注册投资理财账号并完成身份核验", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("investor-name", "投资理财用户姓名", true, REGULATION_SOURCE), field("document-type-number", "证件类型和号码", true, REGULATION_SOURCE), field("document-validity", "证件有效期限", true, REGULATION_SOURCE), field("document-copy", "证件影印件", true, REGULATION_SOURCE)], ["注册和登录账号", "完成投资者身份核验", "履行实名要求"]),
    feature("invest-funding", "资金账户与支付账户", "BASIC", "绑定资金账户、银行卡或支付账号", [field("fund-account", "投资理财用户资金账户", true, REGULATION_SOURCE), field("bank-payment-account", "银行卡号码或支付账号", true, REGULATION_SOURCE)], ["绑定投资资金账户", "完成资金划转", "核对资金账户归属"]),
    feature("invest-trading", "投资交易与持仓", "BASIC", "查询产品、提交交易并管理持仓", [field("risk-assessment", "投资者适当性和风险测评信息"), field("order", "委托和交易信息"), field("holding", "资产和持仓信息")], ["提供投资产品服务", "完成交易委托", "展示持仓和收益"]),
  ], { permissionKeys: ["camera", "photos", "microphone", "notifications"], partnerPurposes: ["身份核验", "银行卡验证", "适当性评估", "交易清算", "行情服务", "安全风控"], partnerInformation: ["身份信息", "账户信息", "交易和持仓信息", "设备和网络信息"] }),

  "mobile-banking": q("mobile-banking", [
    feature("bank-account", "账号与银行客户身份", "BASIC", "注册手机银行并核验银行客户身份", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("customer-name", "用户姓名", true, REGULATION_SOURCE), field("document-type-number", "证件类型和号码", true, REGULATION_SOURCE), field("document-validity", "证件有效期限", true, REGULATION_SOURCE), field("document-copy", "证件影印件", true, REGULATION_SOURCE), field("bank-card", "银行卡号码", true, REGULATION_SOURCE), field("reserved-mobile", "银行预留移动电话号码", true, REGULATION_SOURCE)], ["注册和登录手机银行", "核验银行客户身份", "绑定银行账户"]),
    feature("bank-query", "账户与信息查询", "BASIC", "查询账户余额、明细和银行服务信息", [field("account-balance", "账户余额"), field("transaction-detail", "账户交易明细"), field("query-record", "查询记录")], ["展示银行账户信息", "查询交易明细", "提供账户管理"]),
    feature("bank-transfer", "转账汇款", "BASIC", "向收款账户发起转账汇款", [field("payee-name", "收款人姓名", true, REGULATION_SOURCE), field("payee-card", "收款人银行卡号码", true, REGULATION_SOURCE), field("payee-bank", "收款人开户银行信息", true, REGULATION_SOURCE), field("transfer", "转账金额、时间和附言")], ["完成转账汇款", "核验收款账户", "展示转账记录"]),
    feature("bank-security", "登录与交易安全", "EXTENSION", "使用设备、验证和风险信息保障账户安全", [field("device-network", "设备和网络信息"), field("biometric", "用户主动启用的生物识别验证结果"), field("risk-record", "安全风控记录")], ["保障登录和交易安全", "完成身份验证", "识别异常交易"]),
  ], { permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurposes: ["身份核验", "银行卡验证", "转账清算", "消息通知", "安全风控", "客服"], partnerInformation: ["身份信息", "银行账户信息", "交易信息", "设备和网络信息"] }),

  "medical-registration": q("medical-registration", [
    feature("medical-account", "账号注册", "BASIC", "注册问诊挂号账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "账号信息")], ["注册和登录账号", "管理就诊人信息"]),
    feature("medical-registration", "预约挂号", "BASIC", "填写患者信息并预约医院和科室", [field("patient-name", "患者姓名", true, REGULATION_SOURCE), field("patient-document", "患者证件类型和号码", true, REGULATION_SOURCE), field("hospital", "预约挂号的医院", true, REGULATION_SOURCE), field("department", "预约挂号的科室", true, REGULATION_SOURCE), field("appointment", "预约时间和挂号订单")], ["核验患者身份", "完成预约挂号", "发送就诊提醒"]),
    feature("medical-consultation", "在线问诊", "BASIC", "向医生提交病情并进行在线咨询", [field("condition", "病情描述", true, REGULATION_SOURCE), field("medical-material", "用户主动提交的检查报告、处方或图片"), field("consultation", "问诊沟通记录")], ["提供在线咨询问诊", "向医生展示病情材料", "保存问诊记录"]),
    feature("medical-payment", "医疗费用支付", "EXTENSION", "完成挂号或问诊费用支付和退款", [field("payment", "支付信息"), field("invoice", "票据和发票信息")], ["完成医疗服务支付", "处理退款", "提供票据"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "notifications"], partnerPurposes: ["身份核验", "医院挂号", "在线问诊", "支付", "消息通知", "客服"], partnerInformation: ["患者身份信息", "健康医疗信息", "预约信息", "支付信息", "联系方式"] }),

  "online-game": q("online-game", [
    feature("game-account", "账号注册与登录", "BASIC", "注册游戏账号并进入网络游戏", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("game-account", "游戏账号和角色信息")], ["注册和登录游戏账号", "创建和保存游戏角色"]),
    feature("game-play", "游戏运行与存档", "BASIC", "运行网络游戏并保存进度、道具和战绩", [field("game-progress", "游戏进度和存档"), field("item-record", "虚拟道具和资产记录"), field("device-network", "设备和网络信息")], ["提供网络游戏服务", "保存游戏进度", "保障游戏运行质量"]),
    feature("game-social", "游戏社交与语音", "EXTENSION", "添加好友、组队或进行文字语音交流", [field("friend-list", "游戏好友列表"), field("chat", "游戏内聊天内容"), field("voice", "语音交流内容")], ["提供游戏社交", "完成组队和聊天", "处理举报和违规"]),
    feature("game-payment", "充值与虚拟物品购买", "EXTENSION", "充值或购买虚拟道具和服务", [field("payment", "支付信息"), field("purchase", "充值和购买记录")], ["完成充值和购买", "发放虚拟物品", "处理退款和对账"]),
  ], { permissionKeys: ["microphone", "camera", "photos", "notifications"] }),

  education: q("education", [
    feature("education-account", "账号注册与学员信息", "BASIC", "注册学习账号并维护学员身份", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("learner", "学员昵称、年级或学习阶段")], ["注册和登录账号", "维护学员学习档案"]),
    feature("education-course", "课程学习与课堂", "BASIC", "选课并参加在线辅导或网络课堂", [field("course", "课程和选课信息"), field("learning-record", "学习进度和课堂记录"), field("assignment", "作业、答题和测评内容")], ["提供课程和课堂服务", "记录学习进度", "批改作业和测评"]),
    feature("education-live", "直播课与师生互动", "EXTENSION", "在直播课堂进行音视频和文字互动", [field("audio-video", "课堂音视频内容"), field("interaction", "师生互动记录"), field("device-network", "设备和网络信息")], ["提供直播课堂", "完成师生互动", "保障课堂质量"]),
    feature("education-payment", "课程购买与退款", "EXTENSION", "购买课程并处理退款和开票", [field("payment", "支付信息"), field("order", "课程订单信息"), field("invoice", "发票信息")], ["完成课程购买", "处理退款和对账", "开具发票"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "notifications"] }),

  "womens-health": q("womens-health", [
    feature("women-health-record", "健康周期记录", "BASIC", "在用户主动填写后记录经期、备孕或育儿信息", [field("cycle-record", "用户主动记录的经期和周期信息"), field("pregnancy-record", "用户主动记录的备孕、孕产或育儿信息"), field("symptom", "用户主动记录的症状和身体状况")], ["记录和展示健康周期", "提供日期计算和提醒", "形成用户个人健康记录"]),
    feature("women-tools", "健康工具与内容", "BASIC", "使用健康计算、知识查询和美容美体工具", [field("tool-input", "用户主动输入的计算参数"), field("search-view", "健康内容搜索和浏览记录"), field("preference", "提醒和内容偏好")], ["提供健康计算工具", "展示健康知识", "保存用户设置"]),
    feature("women-reminder", "周期与事项提醒", "EXTENSION", "按照用户设置发送健康事项提醒", [field("reminder-setting", "提醒日期、时间和类型"), field("notification", "通知设置和送达记录")], ["发送用户设置的健康提醒", "管理通知计划"]),
  ], { permissionKeys: ["notifications", "photos", "camera", "sensors"] }),

  fitness: q("fitness", [
    feature("fitness-training", "运动训练与课程", "BASIC", "浏览训练计划并记录用户主动开展的运动", [field("training-record", "训练项目、时长和完成记录"), field("body-input", "用户主动填写的身体和目标信息"), field("device-sport", "设备记录的运动数据")], ["提供运动训练", "记录训练进度", "展示训练结果"]),
    feature("fitness-route", "户外运动轨迹", "EXTENSION", "在用户开启后记录跑步、骑行或步行轨迹", [field("location-route", "位置和运动轨迹"), field("sport-time", "运动时间、距离和速度"), field("sensor", "运动传感器数据")], ["记录户外运动", "计算运动距离和速度", "展示运动轨迹"]),
    feature("fitness-health-device", "健康设备与数据同步", "EXTENSION", "连接用户选择的穿戴设备并同步健康数据", [field("device", "健康设备信息"), field("health-data", "步数、心率、睡眠等健康数据"), field("sync-record", "同步记录")], ["连接健康设备", "同步和展示健康数据", "生成运动统计"]),
  ], { permissionKeys: ["location", "sensors", "photos", "camera", "notifications"] }),

  ebook: q("ebook", [
    feature("ebook-search-read", "图书搜索与阅读", "BASIC", "搜索、打开和阅读电子图书", [field("search-record", "搜索记录"), field("reading-record", "阅读记录和进度"), field("device-setting", "字号、主题等阅读设置")], ["搜索和阅读电子图书", "保存阅读进度", "应用阅读设置"]),
    feature("ebook-shelf", "书架、笔记与同步", "EXTENSION", "收藏图书、添加笔记或跨设备同步", [field("bookshelf", "书架和收藏记录"), field("note", "用户创建的笔记和标注"), field("sync", "同步记录")], ["保存书架和收藏", "保存笔记和标注", "跨设备同步阅读数据"]),
    feature("ebook-purchase", "会员与图书购买", "EXTENSION", "开通会员或购买电子图书", [field("account", "账号信息"), field("order-payment", "订单和支付信息")], ["开通阅读权益", "完成图书购买", "处理退款和对账"]),
  ], { permissionKeys: ["photos", "notifications"] }),

  "mail-cloud": q("mail-cloud", [
    feature("cloud-account", "账号注册", "BASIC", "注册邮箱或云盘账号", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account", "邮箱或云盘账号")], ["注册和登录账号", "识别数据归属"]),
    feature("cloud-mail", "邮件收发", "BASIC", "撰写、发送、接收和管理邮件", [field("mail-contact", "邮件联系人和收发地址"), field("mail-content", "邮件主题、正文和附件"), field("mail-record", "收发和投递记录")], ["发送和接收邮件", "管理邮件和附件", "展示投递状态"]),
    feature("cloud-file", "文件存储与同步", "BASIC", "上传、存储、下载和同步用户文件", [field("file", "用户上传和存储的文件"), field("file-metadata", "文件名称、大小和修改时间"), field("sync-record", "同步和下载记录")], ["存储和管理用户文件", "提供下载和同步", "恢复用户数据"]),
    feature("cloud-share", "文件分享与协作", "EXTENSION", "通过链接或指定账号分享文件", [field("share-recipient", "分享对象"), field("share-link", "分享链接和权限"), field("collaboration", "协作编辑记录")], ["完成文件分享", "管理访问权限", "提供协作编辑"]),
  ], { permissionKeys: ["photos", "camera", "contacts", "notifications", "clipboard"], partnerPurposes: ["登录", "邮件投递", "文件存储", "内容安全", "消息推送", "客服"] }),

  browser: q("browser", [
    feature("browser-web", "网页浏览", "BASIC", "输入网址、搜索或打开互联网信息资源", [field("url", "用户访问的网址"), field("search", "搜索内容"), field("history", "浏览历史"), field("device-network", "设备和网络信息")], ["加载和展示网页", "提供地址栏搜索", "保存用户选择保留的浏览记录"]),
    feature("browser-bookmark", "书签、下载与多端同步", "EXTENSION", "保存书签、下载文件或同步浏览数据", [field("bookmark", "书签和收藏"), field("download", "下载文件和记录"), field("sync", "账号和同步记录")], ["保存书签", "管理下载文件", "跨设备同步浏览数据"]),
    feature("browser-private", "无痕与隐私设置", "EXTENSION", "使用无痕浏览、权限控制和数据清理功能", [field("privacy-setting", "隐私和网站权限设置"), field("clear-record", "清理操作记录")], ["应用用户隐私设置", "控制网站权限", "清理本地浏览数据"]),
  ], { permissionKeys: ["location", "camera", "microphone", "photos", "notifications", "clipboard"] }),

  "input-method": q("input-method", [
    feature("input-basic", "文字与符号输入", "BASIC", "在设备本地提供文字、符号和基础候选输入", [field("local-input", "设备本地临时处理的输入内容"), field("language-setting", "语言、键盘和输入设置"), field("local-dictionary", "设备本地词库")], ["提供文字和符号输入", "生成本地候选词", "应用键盘设置"]),
    feature("input-cloud", "云输入与词库同步", "EXTENSION", "用户开启后使用云候选或同步个人词库", [field("input-fragment", "用于云候选的输入片段"), field("account", "账号信息"), field("dictionary-sync", "个人词库和同步记录")], ["提供云候选词", "同步个人词库", "恢复输入设置"]),
    feature("input-voice", "语音与手写输入", "EXTENSION", "用户主动使用语音、手写或图片识别输入", [field("voice", "用户主动提交的语音"), field("handwriting", "手写轨迹"), field("image-text", "用户主动选择的图片文字")], ["识别语音输入", "识别手写内容", "识别图片文字"]),
  ], { permissionKeys: ["microphone", "camera", "photos", "contacts", "clipboard"] }),

  "security-management": q("security-management", [
    feature("security-scan", "安全扫描与查杀", "BASIC", "扫描病毒、恶意应用、插件和系统风险", [field("app-file-info", "设备上的应用和文件风险信息"), field("system-status", "系统版本和安全状态"), field("scan-result", "扫描和风险检测结果")], ["检测病毒和恶意程序", "识别安全风险", "展示扫描结果"]),
    feature("security-clean", "清理与修复", "BASIC", "清理风险项、无用文件或修复系统漏洞", [field("clean-target", "用户选择清理的文件或风险项"), field("repair-record", "修复和清理记录")], ["执行用户选择的清理", "修复安全风险", "展示处理结果"]),
    feature("security-protect", "实时安全防护", "EXTENSION", "用户开启后监测新增应用、网络或风险行为", [field("device-network", "设备和网络安全信息"), field("risk-event", "安全风险事件"), field("alert-setting", "防护和提醒设置")], ["提供实时安全防护", "识别风险事件", "发送安全提醒"]),
  ], { permissionKeys: ["photos", "notifications", "location"] }),

  "camera-beauty": q("camera-beauty", [
    feature("camera-capture", "拍摄照片与视频", "BASIC", "使用设备相机拍摄照片或视频", [field("captured-media", "用户拍摄的照片和视频"), field("camera-setting", "拍摄参数和设置"), field("location", "用户开启的拍摄位置信息")], ["完成照片和视频拍摄", "应用拍摄设置", "按用户选择记录拍摄位置"]),
    feature("camera-edit", "美颜、滤镜与编辑", "BASIC", "在设备本地或用户选择的服务中编辑图片和视频", [field("media", "用户选择编辑的图片和视频"), field("face-feature", "用于美颜处理的人脸图像特征"), field("edit-setting", "滤镜和编辑参数")], ["完成美颜和滤镜处理", "编辑图片或视频", "保存编辑结果"]),
    feature("camera-cloud", "云端素材与同步", "EXTENSION", "下载素材或将作品同步到用户账号", [field("account", "账号信息"), field("cloud-media", "用户选择上传的作品"), field("template-use", "素材和模板使用记录")], ["提供云端素材", "同步用户作品", "保存创作记录"]),
  ], { permissionKeys: ["camera", "microphone", "photos", "location", "notifications"] }),

  "app-store": q("app-store", [
    feature("store-search-download", "应用搜索与下载", "BASIC", "搜索、查看、下载和更新应用", [field("search-record", "应用搜索记录"), field("download-record", "应用下载和更新记录"), field("device-app", "设备系统和已安装应用兼容信息")], ["搜索和展示应用", "下载和更新应用", "判断设备兼容性"]),
    feature("store-account", "账号、评价与愿望单", "EXTENSION", "登录后评价应用、收藏或同步下载记录", [field("account", "账号信息"), field("review", "评分和评论"), field("wishlist", "收藏和愿望单"), field("sync", "下载记录同步")], ["发布评分和评论", "保存收藏", "跨设备同步下载记录"]),
    feature("store-payment", "付费应用与内购", "EXTENSION", "购买付费应用或应用内商品", [field("order", "购买订单"), field("payment", "支付信息"), field("refund", "退款记录")], ["完成应用购买", "提供购买凭证", "处理退款和对账"]),
  ], { permissionKeys: ["photos", "notifications"] }),

  "practical-tools": q("practical-tools", [
    feature("tool-core", "工具基本功能", "BASIC", "使用日历、天气、翻译、计算、文件管理等用户选择的工具", [field("tool-input", "用户主动输入或选择处理的内容"), field("local-setting", "设备本地的工具设置"), field("result-record", "用户选择保存的处理结果")], ["执行用户选择的工具功能", "展示处理结果", "保存用户设置"]),
    feature("tool-location-sensor", "位置与传感器工具", "EXTENSION", "在天气、指南针、遥控或智能家居等功能需要时使用位置或传感器", [field("location", "位置信息"), field("sensor", "方向、姿态或环境传感器数据"), field("device", "用户连接的设备信息")], ["提供本地天气或位置服务", "实现指南针或传感器工具", "连接用户选择的设备"]),
    feature("tool-file-media", "文件与媒体处理", "EXTENSION", "处理用户主动选择的文件、截图、录音或文档", [field("file", "用户主动选择的文件和文档"), field("screen-media", "截图、录屏或录音内容"), field("conversion", "文件处理和转换记录")], ["管理和处理用户文件", "完成截图录屏或录音", "转换和导出文档"]),
    feature("tool-sync", "备份与多端同步", "EXTENSION", "登录后备份和同步用户工具数据", [field("account", "账号信息"), field("backup", "用户选择备份的数据"), field("sync", "同步记录")], ["备份用户数据", "跨设备同步", "恢复用户设置"]),
  ], { permissionKeys: ["location", "camera", "microphone", "photos", "contacts", "notifications", "sensors", "clipboard"], partnerInformation: commonPartnerInformation }),
};
