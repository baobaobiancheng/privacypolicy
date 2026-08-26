import { expect, test } from "@playwright/test";

test("地图项目完成七个环节并获得可下载政策", async ({ page }) => {
  await page.goto("/projects/new/category");
  await page.getByText("地图导航", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects\/prj_[^/]+\/profile$/);

  await page.getByRole("button", { name: "保存并选择功能" }).click();
  await page.getByRole("button", { name: "进入设备权限" }).click();
  await page.getByRole("button", { name: "进入 SDK 与合作方" }).click();
  await page.getByRole("button", { name: "进入存储与安全" }).click();
  await page.getByRole("button", { name: "确认并进入用户权利" }).click();
  await page.getByRole("button", { name: "确认并进入隐私政策生成" }).click();
  await expect(page).toHaveURL(/\/projects\/prj_[^/]+\/generate$/);

  await page.route(/\/api\/v1\/projects\/[^/]+\/generations$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({ json: { data: {
      id: "gen_00000000-0000-7000-8000-000000000001",
      projectId: "prj_test",
      state: "QUEUED",
      stage: "QUEUED",
      progress: {},
      createdAt: new Date().toISOString(),
    } } });
  });
  await page.route(/\/api\/v1\/projects\/[^/]+\/generations\/[^/]+$/, (route) => route.fulfill({ json: { data: {
    id: "gen_00000000-0000-7000-8000-000000000001",
    state: "SUCCEEDED",
    stage: "COMPLETED",
    progress: { completedSections: 8, totalSections: 8, characterCount: 100 },
    previewMarkdown: "# 行迹地图隐私政策",
    reportId: "rpt_00000000-0000-7000-8000-000000000001",
  } } }));
  await page.route(/\/api\/v1\/projects\/[^/]+\/reports\/rpt_[^/]+$/, (route) => route.fulfill({ json: { data: {
    id: "rpt_00000000-0000-7000-8000-000000000001",
    createdAt: new Date().toISOString(),
    markdown: "# 行迹地图隐私政策\n\n## 1. 我们如何收集和使用个人信息\n\n测试正文。",
    downloadUrl: route.request().url() + "/content",
  } } }));
  await page.route(/\/api\/v1\/projects\/[^/]+\/reports\/rpt_[^/]+\/content$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    headers: { "Content-Disposition": "attachment; filename=privacy-policy.docx" },
    body: Buffer.from("PK-test-docx"),
  }));
  const inFlightProjectSaves = new Set<import("@playwright/test").Request>();
  let maximumConcurrentProjectSaves = 0;
  let generationRequested = false;
  let savesAfterGenerationRequest = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && /\/api\/v1\/projects\/prj_[^/]+$/.test(request.url())) {
      inFlightProjectSaves.add(request);
      maximumConcurrentProjectSaves = Math.max(maximumConcurrentProjectSaves, inFlightProjectSaves.size);
      if (generationRequested) savesAfterGenerationRequest += 1;
    }
    if (request.method() === "POST" && /\/api\/v1\/projects\/prj_[^/]+\/generations$/.test(request.url())) generationRequested = true;
  });
  const finishProjectSave = (request: import("@playwright/test").Request) => inFlightProjectSaves.delete(request);
  page.on("requestfinished", finishProjectSave);
  page.on("requestfailed", finishProjectSave);
  await page.getByRole("button", { name: "生成隐私政策" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByText("测试正文。")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  expect(maximumConcurrentProjectSaves).toBeLessThanOrEqual(1);
  expect(savesAfterGenerationRequest).toBe(0);
  await expect(page.getByRole("button", { name: /下载 Word/ })).toBeVisible();
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: /下载 Word/ }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(await downloadPromise).toBeTruthy();
});
