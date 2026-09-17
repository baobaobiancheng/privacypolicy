import type { AppCategoryKey } from "@/src/questionnaires";

export type DevelopmentScenario = {
  productName: string;
  operatorName: string;
  platform: string;
  permissionKeys: string[];
  partnerPurpose: string;
  extraInformation: string;
  retentionSummary: string;
  minorMode?: "ADULT_ONLY" | "MINORS_WITH_GUARDIAN" | "CHILD_DIRECTED";
};

type NonMapCategoryKey = Exclude<AppCategoryKey, "map-navigation">;

/**
 * 仅用于开发演示的行业场景，不属于法规知识或客户事实。
 * 每个法定类别都显式给出一套可辨识的产品事实，避免用地图数据或一套
 * “示例产品”覆盖所有行业。正式上线前由 NEXT_PUBLIC_DEV_FORM_DEFAULTS 统一关闭。
 */
export const developmentScenarios = {
  "ride-hailing": { productName: "畅行约车", operatorName: "杭州畅行出行科技有限公司", platform: "Android、iOS", permissionKeys: ["location", "camera", "photos", "contacts", "notifications"], partnerPurpose: "车辆定位与调度", extraInformation: "司机接单状态和预计到达时间", retentionSummary: "行程和订单记录保存至订单完成后 3 年；安全事件记录按处理需要和法定要求保存" },
  "transport-ticket": { productName: "一路票务", operatorName: "杭州一路票务科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["camera", "photos", "notifications"], partnerPurpose: "票务核验", extraInformation: "电子票二维码和检票状态", retentionSummary: "票务订单和行程记录保存至订单完成后 3 年；发票及依法留存的交易记录按法定期限保存" },
  "travel-service": { productName: "云游旅行", operatorName: "杭州云游旅行服务有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "旅游产品履约", extraInformation: "出团通知和行程确认记录", retentionSummary: "旅游订单和履约记录保存至行程结束后 3 年；用户上传的咨询材料在问题处理后 180 日内清理" },
  "hotel-service": { productName: "安住酒店", operatorName: "杭州安住网络科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "酒店库存与预订", extraInformation: "入住偏好和预订确认号", retentionSummary: "酒店预订记录保存至退房后 3 年；浏览和搜索记录保存 90 日" },
  "local-life": { productName: "邻里生活", operatorName: "杭州邻里生活科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "上门服务履约", extraInformation: "上门时间和服务进度", retentionSummary: "服务订单保存至订单完成后 3 年；用户发布内容保存至用户删除或注销账号" },
  "vehicle-service": { productName: "轻行用车", operatorName: "杭州轻行交通科技有限公司", platform: "Android、iOS", permissionKeys: ["location", "camera", "photos", "notifications", "sensors"], partnerPurpose: "车辆定位与开锁", extraInformation: "车辆开关锁状态和剩余电量", retentionSummary: "用车订单和行程记录保存至订单完成后 3 年；车辆安全事件记录按处理需要保存" },
  "performance-ticket": { productName: "星幕票务", operatorName: "杭州星幕文化科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["camera", "photos", "notifications"], partnerPurpose: "电子票核验", extraInformation: "电子票凭证和入场核验状态", retentionSummary: "购票与验票记录保存至演出结束后 3 年；浏览记录保存 90 日" },

  "instant-messaging": { productName: "同舟消息", operatorName: "杭州同舟通信科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["camera", "microphone", "photos", "contacts", "notifications", "clipboard"], partnerPurpose: "音视频通信", extraInformation: "消息撤回状态和多端同步状态", retentionSummary: "账号和用户选择保留的通信记录保存至用户删除或注销；送达日志保存 30 日" },
  "online-community": { productName: "邻声社区", operatorName: "杭州邻声网络科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["camera", "microphone", "photos", "notifications", "location"], partnerPurpose: "内容审核", extraInformation: "帖子草稿和内容审核状态", retentionSummary: "用户发布内容保存至用户删除或注销；违规处置记录按平台治理需要保存" },
  dating: { productName: "心遇", operatorName: "杭州心遇信息科技有限公司", platform: "Android、iOS", permissionKeys: ["location", "camera", "microphone", "photos", "notifications"], partnerPurpose: "身份核验", extraInformation: "实名认证状态和匹配屏蔽名单", retentionSummary: "婚恋资料保存至用户删除或注销；投诉举报材料在处理完成后保存 1 年", minorMode: "ADULT_ONLY" },
  "remote-meeting": { productName: "云议", operatorName: "杭州云议协同科技有限公司", platform: "Android、iOS、Windows、macOS、Web", permissionKeys: ["camera", "microphone", "photos", "notifications", "clipboard"], partnerPurpose: "实时音视频", extraInformation: "会议主持权限和参会状态", retentionSummary: "会议基础记录保存 180 日；用户主动录制的文件保存至用户删除或空间到期" },
  "live-streaming": { productName: "星播", operatorName: "杭州星播互动科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["camera", "microphone", "photos", "notifications", "location"], partnerPurpose: "直播分发与内容审核", extraInformation: "直播间管理记录和违规处置状态", retentionSummary: "观看记录保存 90 日；直播内容和审核记录按内容治理及法定要求保存" },
  "online-av": { productName: "光影音乐", operatorName: "杭州光影数字科技有限公司", platform: "Android、iOS、Web、TV", permissionKeys: ["microphone", "photos", "notifications"], partnerPurpose: "音视频内容分发", extraInformation: "播放清晰度和版权区域校验结果", retentionSummary: "播放和搜索记录保存 180 日；会员订单依法保存，离线内容由用户主动删除或授权到期清理" },
  "short-video": { productName: "闪映", operatorName: "杭州闪映网络科技有限公司", platform: "Android、iOS", permissionKeys: ["camera", "microphone", "photos", "location", "notifications"], partnerPurpose: "视频转码与内容审核", extraInformation: "视频草稿和发布审核状态", retentionSummary: "视频草稿保存 30 日；发布内容保存至用户删除，审核和违规记录按治理需要保存" },
  news: { productName: "今日简报", operatorName: "杭州简报信息科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["notifications", "photos", "location"], partnerPurpose: "资讯内容分发", extraInformation: "频道订阅和阅读进度", retentionSummary: "搜索和阅读记录保存 90 日；订阅和收藏保存至用户删除或注销" },

  "online-payment": { productName: "安付", operatorName: "杭州安付支付科技有限公司", platform: "Android、iOS", permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurpose: "身份核验与支付清算", extraInformation: "实名核验结果和交易风险等级", retentionSummary: "身份、账户和交易记录依据支付及反洗钱相关要求保存；超期后删除或匿名化", minorMode: "ADULT_ONLY" },
  "online-shopping": { productName: "好物集", operatorName: "杭州好物电子商务有限公司", platform: "Android、iOS、微信小程序、Web", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "订单支付与物流", extraInformation: "优惠券使用记录和售后进度", retentionSummary: "订单、支付和售后记录保存至交易完成后 3 年；浏览记录保存 90 日" },
  "food-delivery": { productName: "即刻外卖", operatorName: "杭州即刻生活科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "配送定位与订单履约", extraInformation: "餐品备注和配送进度", retentionSummary: "外卖订单和配送记录保存至订单完成后 3 年；定位信息仅在下单和配送场景按需处理" },
  "mail-express": { productName: "速达寄递", operatorName: "杭州速达物流科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["location", "camera", "photos", "contacts", "notifications"], partnerPurpose: "运单路由与物流跟踪", extraInformation: "运单号、包裹状态和签收凭证", retentionSummary: "寄递详情单和身份查验记录按邮政寄递相关要求保存；查询记录保存 90 日" },
  housing: { productName: "安居房产", operatorName: "杭州安居房产信息有限公司", platform: "Android、iOS、Web", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "房源核验", extraInformation: "房源核验状态和带看预约记录", retentionSummary: "房源信息保存至发布者删除或下架；预约和沟通记录在服务结束后保存 1 年" },
  "used-car": { productName: "易车汇", operatorName: "杭州易车汇信息科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "车辆信息核验", extraInformation: "车辆检测报告和估值记录", retentionSummary: "车辆发布信息保存至下架或用户删除；交易撮合记录保存至服务结束后 3 年" },

  recruitment: { productName: "职途", operatorName: "杭州职途人力科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["location", "camera", "photos", "notifications"], partnerPurpose: "简历解析与职位投递", extraInformation: "求职意向和投递进度", retentionSummary: "简历和求职资料保存至用户删除或注销；投递记录保存 1 年" },
  "online-lending": { productName: "惠借", operatorName: "杭州惠借信息服务有限公司", platform: "Android、iOS", permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurpose: "身份核验与信用评估", extraInformation: "授信申请状态和还款计划", retentionSummary: "身份、授信、借款和还款记录依据金融监管及法定要求保存；超期后删除或匿名化", minorMode: "ADULT_ONLY" },
  investment: { productName: "稳投", operatorName: "杭州稳投信息科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["camera", "photos", "microphone", "notifications"], partnerPurpose: "身份核验与交易服务", extraInformation: "投资者适当性测评结果和自选产品", retentionSummary: "开户、适当性、交易和录音录像记录依据金融监管及法定要求保存", minorMode: "ADULT_ONLY" },
  "mobile-banking": { productName: "示例城商银行", operatorName: "示例城商银行股份有限公司", platform: "Android、iOS", permissionKeys: ["camera", "photos", "contacts", "notifications", "location"], partnerPurpose: "身份核验与银行卡服务", extraInformation: "登录设备绑定状态和交易授权记录", retentionSummary: "客户身份、账户及交易记录依据银行和反洗钱相关要求保存；超期后按规则处理", minorMode: "ADULT_ONLY" },

  "medical-registration": { productName: "云诊", operatorName: "杭州云诊健康科技有限公司", platform: "Android、iOS、微信小程序", permissionKeys: ["camera", "microphone", "photos", "notifications"], partnerPurpose: "医院号源与在线问诊", extraInformation: "就诊人关系和问诊附件", retentionSummary: "挂号订单保存至服务完成后 3 年；问诊记录依医疗服务和法定要求保存" },
  "online-game": { productName: "星河游戏", operatorName: "杭州星河互动科技有限公司", platform: "Android、iOS、Windows", permissionKeys: ["microphone", "photos", "notifications"], partnerPurpose: "实名认证与防沉迷", extraInformation: "游戏角色、区服和防沉迷状态", retentionSummary: "账号和虚拟资产记录保存至账号注销后按规则处理；实名和防沉迷记录依法保存", minorMode: "MINORS_WITH_GUARDIAN" },
  education: { productName: "知行课堂", operatorName: "杭州知行教育科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["camera", "microphone", "photos", "notifications"], partnerPurpose: "在线课堂与作业批改", extraInformation: "课程进度、作业和教师评语", retentionSummary: "学习档案保存至用户删除或注销；课堂录制和作业材料按课程服务期限保存", minorMode: "MINORS_WITH_GUARDIAN" },
  "womens-health": { productName: "悦期", operatorName: "杭州悦期健康科技有限公司", platform: "Android、iOS", permissionKeys: ["notifications", "photos"], partnerPurpose: "健康提醒", extraInformation: "经期预测结果和提醒设置", retentionSummary: "健康记录主要保存至用户删除或注销；本地提醒设置由用户清理 App 数据时删除", minorMode: "ADULT_ONLY" },
  fitness: { productName: "动力健身", operatorName: "杭州动力运动科技有限公司", platform: "Android、iOS、可穿戴设备", permissionKeys: ["location", "sensors", "camera", "photos", "notifications"], partnerPurpose: "运动数据同步", extraInformation: "训练计划和设备连接状态", retentionSummary: "运动记录保存至用户删除或注销；实时运动定位仅在训练期间处理" },
  ebook: { productName: "墨卷阅读", operatorName: "杭州墨卷数字科技有限公司", platform: "Android、iOS、Web", permissionKeys: ["photos", "notifications"], partnerPurpose: "数字内容分发", extraInformation: "书签、批注和阅读进度", retentionSummary: "书架、书签和阅读进度保存至用户删除或注销；搜索记录保存 90 日" },

  "mail-cloud": { productName: "云笺邮箱云盘", operatorName: "杭州云笺信息科技有限公司", platform: "Android、iOS、Web、Windows、macOS", permissionKeys: ["camera", "photos", "contacts", "notifications", "clipboard"], partnerPurpose: "邮件投递与云端存储", extraInformation: "文件版本和共享链接状态", retentionSummary: "邮件和云端文件保存至用户删除、清空回收站或账号注销；安全日志保存 180 日" },
  browser: { productName: "清览浏览器", operatorName: "杭州清览网络科技有限公司", platform: "Android、iOS、Windows、macOS", permissionKeys: ["location", "camera", "microphone", "photos", "notifications", "clipboard"], partnerPurpose: "安全浏览与网页防护", extraInformation: "用户选择同步的书签和标签页", retentionSummary: "本地浏览记录由用户自行清理；开启同步后的书签和设置保存至用户删除或注销" },
  "input-method": { productName: "灵犀输入法", operatorName: "杭州灵犀智能科技有限公司", platform: "Android、iOS、Windows、macOS", permissionKeys: ["microphone", "photos", "contacts", "clipboard"], partnerPurpose: "语音识别", extraInformation: "用户词库和输入设置", retentionSummary: "本地词库保存于设备；用户主动开启云同步后的词库保存至用户删除或关闭同步" },
  "security-management": { productName: "安盾安全", operatorName: "杭州安盾网络安全有限公司", platform: "Android、Windows、macOS", permissionKeys: ["photos", "notifications"], partnerPurpose: "恶意程序特征识别", extraInformation: "风险文件特征和修复结果", retentionSummary: "扫描结果主要保存于设备；去标识化安全事件和故障日志保存 180 日" },
  "camera-beauty": { productName: "拾光相机", operatorName: "杭州拾光影像科技有限公司", platform: "Android、iOS", permissionKeys: ["camera", "microphone", "photos", "location"], partnerPurpose: "云端素材与图像处理", extraInformation: "滤镜参数和用户选择保存的作品", retentionSummary: "本地作品由用户管理；主动上传的云端作品保存至用户删除或账号注销" },
  "app-store": { productName: "应用汇", operatorName: "杭州应用汇网络科技有限公司", platform: "Android、Web", permissionKeys: ["photos", "notifications"], partnerPurpose: "应用下载与安全检测", extraInformation: "设备兼容性检测结果和更新状态", retentionSummary: "下载和更新记录保存 180 日；账号评价和收藏保存至用户删除或注销" },
  "practical-tools": { productName: "万能工具箱", operatorName: "杭州万用智能科技有限公司", platform: "Android、iOS", permissionKeys: ["location", "camera", "microphone", "photos", "contacts", "notifications", "sensors", "clipboard"], partnerPurpose: "文件转换与云同步", extraInformation: "用户主动保存的工具结果和快捷配置", retentionSummary: "工具输入和结果默认保存在设备本地；主动开启云备份后的数据保存至用户删除或关闭备份" },
} satisfies Record<NonMapCategoryKey, DevelopmentScenario>;

export function getDevelopmentScenario(categoryKey: string): DevelopmentScenario | null {
  if (categoryKey === "map-navigation") return null;
  return developmentScenarios[categoryKey as NonMapCategoryKey] ?? null;
}
