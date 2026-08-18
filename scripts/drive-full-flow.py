import json, urllib.request, base64, hashlib, os, sys, time

BASE = "http://localhost:3000"
PID = "map-mswnv1iv8301ef"
PERSONA = "client-editor"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, method=method,
        headers={"Content-Type": "application/json", "x-persona-id": PERSONA})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

profile = {
    "operatorName": "杭州行迹科技有限公司",
    "operatorContact": "浙江省杭州市西湖区文三路 100 号",
    "productName": "行迹地图",
    "productVersion": "Android 2.4 / iOS 2.4",
    "contactEmail": "privacy@example.com",
    "rightsEntry": "App 内「我的」-「隐私中心」",
    "rightsResponsePeriod": "收到申请后 15 个工作日内回复",
    "minorProcessing": "不面向未成年人提供服务，发现后删除",
    "securityMeasures": "访问控制、传输加密、最小权限",
    "incidentChannel": "隐私联系邮箱与 App 内公告",
    "policyEffectiveDate": "2026-08-10",
    "policyUpdateNotice": "App 弹窗与隐私政策页面提示",
}

scopeAnswers = {"single-product": True, "map-primary": True, "single-category": True, "no-cross-border": True}

selected = ["navigation", "traffic"]
activityDetails = {
    "navigation": {"purpose": "提供定位、路线规划与导航", "retention": "导航结束后删除或去标识化"},
    "traffic": {"purpose": "展示实时路况与导航避堵", "retention": "会话结束后删除，不长期保存"},
}
# 稳定字段键
fields = {
    "navigation.location": "PROCESS", "navigation.origin": "PROCESS", "navigation.destination": "PROCESS",
    "traffic.location": "PROCESS", "traffic.road_position": "PROCESS", "traffic.usage_time": "PROCESS",
}
confirmedFields = [k for k, v in fields.items() if v == "PROCESS"]
fieldAnswers = fields

supplementAnswers = {
    "device-permissions": {"answer": "YES", "detail": "仅在前台导航、路线规划和实时路况展示时申请定位权限；相机、通讯录等权限此项功能不使用。", "slots": {}},
    "third-party-services": {"answer": "YES", "detail": "使用示例定位 SDK 提供定位能力。", "slots": {
        "service-name": {"value": "示例定位 SDK", "status": "CONFIRMED"},
        "provider-name": {"value": "示例定位技术有限公司", "status": "CONFIRMED"},
        "purpose": {"value": "获取设备位置以完成定位、路线规划和持续导航", "status": "CONFIRMED"},
        "data-types": {"value": "位置信息、设备标识符、网络状态", "status": "CONFIRMED"},
        "initialization-timing": {"value": "用户点击开始导航后初始化并首次上报位置", "status": "CONFIRMED"},
        "privacy-policy-url": {"value": "https://example.com/sdk/privacy", "status": "CONFIRMED"},
    }},
    "storage-locations": {"answer": "YES", "detail": "位置与历史路线保存在设备本地，服务器仅保存账号关联的收藏与设置。", "slots": {
        "data-types": {"value": "收藏地点、常用地址、偏好设置、路线规划记录", "status": "CONFIRMED"},
        "storage-location": {"value": "设备本地存储；账号相关数据保存在中国境内的云服务器", "status": "CONFIRMED"},
        "retention": {"value": "账号存续期间保存，注销后 30 日内删除", "status": "CONFIRMED"},
        "deletion-method": {"value": "删除或匿名化后清除备份", "status": "CONFIRMED"},
    }},
    "account-cloud-sync": {"answer": "YES", "detail": "支持手机号登录，账号数据云端同步。", "slots": {
        "login-method": {"value": "手机号验证码或微信快捷登录", "status": "CONFIRMED"},
        "sync-data": {"value": "收藏地点、常用地址、历史路线和偏好设置", "status": "CONFIRMED"},
        "activation-condition": {"value": "由用户主动登录并在设置中开启云端同步", "status": "CONFIRMED"},
        "disable-path": {"value": "设置-账号与同步中随时关闭；关闭后本地功能仍可用", "status": "CONFIRMED"},
        "deletion-rule": {"value": "用户可手动删除，注销账号后 30 日内清除云端数据", "status": "CONFIRMED"},
    }},
    "background-location": {"answer": "YES", "detail": "导航过程中退到后台或锁屏时持续提供位置提示。", "slots": {
        "trigger": {"value": "用户开始导航且尚未到达目的地时", "status": "CONFIRMED"},
        "screen-state": {"value": "退到后台或锁屏后继续获取位置，退出导航后立即停止", "status": "CONFIRMED"},
        "frequency": {"value": "按导航进度实时获取，非定时轮询", "status": "CONFIRMED"},
        "purpose": {"value": "持续导航、路线纠偏和到达提醒", "status": "CONFIRMED"},
        "retention": {"value": "导航结束后删除，不长期保存轨迹", "status": "CONFIRMED"},
        "disable-path": {"value": "系统设置或 App 内关闭定位权限；关闭后导航功能不可用", "status": "CONFIRMED"},
    }},
    "third-party-initialization": {"answer": "NO", "detail": "", "slots": {}},
    "user-control-paths": {"answer": "YES", "detail": "用户可在「我的-隐私中心」查看、导出、更正或删除个人信息，并可撤回授权和注销账号。", "slots": {}},
    "notification-push": {"answer": "NO", "detail": "", "slots": {}},
    "cookies-local-storage": {"answer": "NO", "detail": "", "slots": {}},
    "sensitive-information": {"answer": "NO", "detail": "", "slots": {}},
    "sharing-transfer-public": {"answer": "NO", "detail": "", "slots": {}},
    "shutdown-data-handling": {"answer": "NO", "detail": "", "slots": {}},
}

form = {
    "profile": profile,
    "selected": selected,
    "customFeatures": [],
    "customDetails": {},
    "activityDetails": activityDetails,
    "confirmedFields": confirmedFields,
    "fieldAnswers": fieldAnswers,
    "additionalNotes": "使用定位 SDK 仅在用户点击开始导航后获取前台定位；不做持续后台轨迹记录。",
    "scopeAnswers": scopeAnswers,
    "supplementAnswers": supplementAnswers,
}

# 1. 取 revision（模拟页面水合）
st, payload = req("GET", f"/api/projects/{PID}")
revision = payload["revision"]
print("revision =", revision)

def attempt(gen_id, token=None):
    body = {
        "projectId": PID,
        "expectedRevision": revision,
        "generationId": gen_id,
        **form,
    }
    if token:
        body["acknowledgedPreflightReviewToken"] = token
    return req("POST", "/api/draft/demo", body)

st, payload = attempt(f"report-{int(time.time())}")
print("first attempt:", st, payload.get("code"))
if st == 422 and payload.get("code") == "FORM_SEMANTIC_REVIEW_REQUIRED":
    token = payload.get("reviewToken")
    issues = payload.get("issues", [])
    print("  preflight blocking issues:", len([i for i in issues if i['severity']=='BLOCKING']))
    for i in issues:
        print("   -", i['severity'], i['category'], i['title'])
    # 页面语义：“信息无误，保留当前填写”→ 用返回的 reviewToken 确认
    st, payload = attempt(f"report-{int(time.time())}-ack", token)
    print("ack attempt:", st, payload.get("code"))
elif st == 400:
    print("  400:", json.dumps(payload.get("details"), ensure_ascii=False)[:800])
    sys.exit(1)

if st != 200 or not payload.get("docxBase64"):
    print("FAILED:", st, json.dumps(payload, ensure_ascii=False)[:1200])
    sys.exit(1)

out_dir = os.path.abspath(".")
md_path = os.path.join(out_dir, "报告-demo.md")
docx_path = os.path.join(out_dir, "行迹地图-隐私政策草稿.docx")
with open(md_path, "w") as f:
    f.write(payload["markdown"])
docx = base64.b64decode(payload["docxBase64"])
with open(docx_path, "wb") as f:
    f.write(docx)
print("SUCCESS")
print("markdown bytes:", len(payload["markdown"]), "docx bytes:", len(docx))
print("model:", payload.get("model"), "file:", payload.get("filename"))
print("md ->", md_path)
print("docx ->", docx_path)
