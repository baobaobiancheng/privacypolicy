import { getRequestId } from "./api-error";

export async function withApiTiming<T extends Response>(
  request: Request,
  routeTemplate: string,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  let status = 500;
  let response: T | undefined;
  try {
    response = await handler();
    status = response.status;
    return response;
  } finally {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    console.info(JSON.stringify({
      level: durationMs >= 1_000 ? "warn" : "info",
      event: "api_request_completed",
      requestId: response?.headers.get("x-request-id") ?? getRequestId(request),
      route: routeTemplate,
      method: request.method,
      status,
      durationMs,
    }));
  }
}
