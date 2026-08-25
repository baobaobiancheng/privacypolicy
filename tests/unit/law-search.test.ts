import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLawsByKeywords } from "@/src/law/baijian";

describe("law keyword search concurrency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BAIJIAN_APP_KEY;
    delete process.env.BAIJIAN_APP_SECRET;
  });

  it("uses bounded concurrency and preserves keyword order", async () => {
    process.env.BAIJIAN_APP_KEY = "test-app-key";
    process.env.BAIJIAN_APP_SECRET = "test-app-secret";
    let active = 0;
    let maximumActive = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const request = JSON.parse(String(init?.body)) as { params: { arguments: { keyword: string } } };
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(JSON.stringify({
        result: {
          content: [{
            text: JSON.stringify({
              code: "200",
              data: { lawdata: [{ lawId: `law-${request.params.arguments.keyword}`, lawName: request.params.arguments.keyword }] },
            }),
          }],
        },
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const keywords = ["个人信息保护法", "网络数据安全", "必要个人信息", "儿童个人信息", "数据出境"];
    const results = await searchLawsByKeywords(keywords);

    expect(results.map((result) => result.keyword)).toEqual(keywords);
    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(3);
  });
});
