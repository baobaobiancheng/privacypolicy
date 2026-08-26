import { Prisma, type PrismaClient } from "@prisma/client";
import type { SessionActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { createEntityId } from "@/src/domain/ids";
import type { AnalyticsEventName } from "./contract";
import { runtimeConfig } from "@/src/config/runtime";

type AnalyticsProperties = Record<string, string | number | boolean | null>;

export async function recordAnalyticsEvent(input: {
  actor: SessionActor;
  eventName: AnalyticsEventName;
  projectId?: string | null;
  sessionId?: string | null;
  pagePath?: string | null;
  durationMs?: number | null;
  properties?: AnalyticsProperties;
  occurredAt?: Date;
}, prisma: PrismaClient = getPrisma()) {
  await prisma.analyticsEvent.create({
    data: {
      id: createEntityId("evt"),
      tenantId: input.actor.tenantId,
      userId: input.actor.userId,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      eventName: input.eventName,
      pagePath: input.pagePath ?? null,
      durationMs: input.durationMs ?? null,
      properties: input.properties as Prisma.InputJsonValue | undefined,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

export async function recordAnalyticsEventSafely(input: Parameters<typeof recordAnalyticsEvent>[0], prisma?: PrismaClient) {
  try {
    await recordAnalyticsEvent(input, prisma);
  } catch (error) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "analytics_event_write_failed",
      eventName: input.eventName,
      message: error instanceof Error ? error.message : "unknown error",
    }));
  }
}

type AnalyticsSummary = Awaited<ReturnType<typeof queryAnalyticsSummary>>;
const analyticsSummaryCache = new Map<string, { expiresAt: number; value: Promise<AnalyticsSummary> }>();
const ANALYTICS_SUMMARY_CACHE_MAX_ENTRIES = 1_000;

function pruneAnalyticsSummaryCache(now: number): void {
  for (const [key, entry] of analyticsSummaryCache) {
    if (entry.expiresAt <= now) analyticsSummaryCache.delete(key);
  }

  while (analyticsSummaryCache.size >= ANALYTICS_SUMMARY_CACHE_MAX_ENTRIES) {
    const oldestKey = analyticsSummaryCache.keys().next().value;
    if (oldestKey === undefined) break;
    analyticsSummaryCache.delete(oldestKey);
  }
}

export async function getAnalyticsSummary(
  actor: SessionActor,
  range: { from: Date; to: Date },
  prisma: PrismaClient = getPrisma(),
): Promise<AnalyticsSummary> {
  const ttl = runtimeConfig.analyticsSummaryCacheTtlMs;
  if (ttl <= 0) return queryAnalyticsSummary(actor, range, prisma);
  const now = Date.now();
  const key = `${actor.tenantId}:${Math.floor(range.from.getTime() / ttl)}:${Math.floor(range.to.getTime() / ttl)}`;
  const cached = analyticsSummaryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = queryAnalyticsSummary(actor, range, prisma).catch((error) => {
    analyticsSummaryCache.delete(key);
    throw error;
  });
  pruneAnalyticsSummaryCache(now);
  analyticsSummaryCache.set(key, { expiresAt: now + ttl, value });
  return value;
}

export function clearAnalyticsSummaryCache(): void {
  analyticsSummaryCache.clear();
}

async function queryAnalyticsSummary(actor: SessionActor, range: { from: Date; to: Date }, prisma: PrismaClient) {
  const [eventGroups, generationRows, pageRows, buttonRows, funnelRows] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      where: { tenantId: actor.tenantId, occurredAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
      _sum: { durationMs: true },
      _avg: { durationMs: true },
    }),
    queryGenerationSummary(prisma, actor.tenantId, range),
    queryPageBreakdown(prisma, actor.tenantId, range),
    queryButtonBreakdown(prisma, actor.tenantId, range),
    queryProjectFunnel(prisma, actor.tenantId, range),
  ]);
  const eventMap = new Map(eventGroups.map((group) => [group.eventName, group]));
  const count = (name: AnalyticsEventName) => eventMap.get(name)?._count._all ?? 0;
  const uploadSucceeded = count("FILE_UPLOAD_SUCCEEDED");
  const uploadFailed = count("FILE_UPLOAD_FAILED");
  const uploadTotal = uploadSucceeded + uploadFailed;

  const generation = generationRows[0];
  const generationTotal = Number(generation?.total ?? 0);
  const generationSucceeded = Number(generation?.succeeded ?? 0);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    generation: {
      total: generationTotal,
      succeeded: generationSucceeded,
      failed: Number(generation?.failed ?? 0),
      successRate: generationTotal ? generationSucceeded / generationTotal : null,
      averageDurationMs: generation?.averageDurationMs === null || generation?.averageDurationMs === undefined
        ? null
        : Math.round(Number(generation.averageDurationMs)),
    },
    uploads: {
      total: uploadTotal,
      succeeded: uploadSucceeded,
      failed: uploadFailed,
      successRate: uploadTotal ? uploadSucceeded / uploadTotal : null,
    },
    wordDownloads: count("WORD_DOWNLOADED"),
    pageViews: count("PAGE_VIEW"),
    pageDuration: {
      samples: count("PAGE_DURATION"),
      totalMs: eventMap.get("PAGE_DURATION")?._sum.durationMs ?? 0,
      averageMs: Math.round(eventMap.get("PAGE_DURATION")?._avg.durationMs ?? 0),
    },
    buttonClicks: count("BUTTON_CLICK"),
    assistantQuestions: count("AI_ASSISTANT_QUESTION"),
    pages: pageRows.map((row) => ({
      path: row.pagePath,
      views: numeric(row.views),
      durationSamples: numeric(row.durationSamples),
      averageDurationMs: Math.round(numeric(row.averageDurationMs)),
    })),
    buttons: buttonRows.map((row) => ({
      pagePath: row.pagePath,
      action: row.action,
      clicks: numeric(row.clicks),
    })),
    funnel: normalizeFunnel(funnelRows[0]),
  };
}

type NumericDatabaseValue = bigint | number | string | null;

type GenerationSummaryRow = {
  total: NumericDatabaseValue;
  succeeded: NumericDatabaseValue;
  failed: NumericDatabaseValue;
  averageDurationMs: number | null;
};

type PageBreakdownRow = {
  pagePath: string;
  views: NumericDatabaseValue;
  durationSamples: NumericDatabaseValue;
  averageDurationMs: NumericDatabaseValue;
};

type ButtonBreakdownRow = {
  pagePath: string;
  action: string;
  clicks: NumericDatabaseValue;
};

export type ProjectFunnelRow = {
  categorySelected: NumericDatabaseValue;
  profileCompleted: NumericDatabaseValue;
  processingCompleted: NumericDatabaseValue;
  permissionsCompleted: NumericDatabaseValue;
  partnersCompleted: NumericDatabaseValue;
  storageCompleted: NumericDatabaseValue;
  rightsCompleted: NumericDatabaseValue;
  generationSucceeded: NumericDatabaseValue;
  wordDownloaded: NumericDatabaseValue;
};

export function normalizeFunnel(row?: ProjectFunnelRow) {
  return {
    unit: "unique_projects" as const,
    stages: [
      { key: "category_selected", label: "选择类别", projects: numeric(row?.categorySelected) },
      { key: "profile_completed", label: "基本信息", projects: numeric(row?.profileCompleted) },
      { key: "processing_completed", label: "功能与个人信息", projects: numeric(row?.processingCompleted) },
      { key: "permissions_completed", label: "设备权限", projects: numeric(row?.permissionsCompleted) },
      { key: "partners_completed", label: "SDK 与合作方", projects: numeric(row?.partnersCompleted) },
      { key: "storage_completed", label: "存储与安全", projects: numeric(row?.storageCompleted) },
      { key: "rights_completed", label: "用户权利", projects: numeric(row?.rightsCompleted) },
      { key: "generation_succeeded", label: "生成成功", projects: numeric(row?.generationSucceeded) },
      { key: "word_downloaded", label: "下载 Word", projects: numeric(row?.wordDownloaded) },
    ],
  };
}

function numeric(value: NumericDatabaseValue | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function queryGenerationSummary(prisma: PrismaClient, tenantId: string, range: { from: Date; to: Date }) {
  return prisma.$queryRaw<GenerationSummaryRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN gj.state = 'SUCCEEDED' THEN 1 ELSE 0 END) AS succeeded,
      SUM(CASE WHEN gj.state = 'FAILED' THEN 1 ELSE 0 END) AS failed,
      AVG(CASE
        WHEN gj.state = 'SUCCEEDED' AND gj.startedAt IS NOT NULL AND gj.completedAt IS NOT NULL
        THEN TIMESTAMPDIFF(MICROSECOND, gj.startedAt, gj.completedAt) / 1000
        ELSE NULL
      END) AS averageDurationMs
    FROM generation_jobs gj
    INNER JOIN projects p ON p.id = gj.projectId
    WHERE p.tenantId = ${tenantId}
      AND gj.createdAt >= ${range.from}
      AND gj.createdAt < ${range.to}
      AND gj.state IN ('SUCCEEDED', 'FAILED')
  `);
}

function queryPageBreakdown(prisma: PrismaClient, tenantId: string, range: { from: Date; to: Date }) {
  return prisma.$queryRaw<PageBreakdownRow[]>(Prisma.sql`
    SELECT
      views.pagePath,
      views.views,
      COALESCE(durations.durationSamples, 0) AS durationSamples,
      COALESCE(durations.averageDurationMs, 0) AS averageDurationMs
    FROM (
      SELECT pagePath, COUNT(*) AS views
      FROM analytics_events
      WHERE tenantId = ${tenantId}
        AND eventName = 'PAGE_VIEW'
        AND occurredAt >= ${range.from}
        AND occurredAt < ${range.to}
        AND pagePath IS NOT NULL
      GROUP BY pagePath
    ) views
    LEFT JOIN (
      SELECT pagePath, COUNT(*) AS durationSamples, AVG(durationMs) AS averageDurationMs
      FROM analytics_events
      WHERE tenantId = ${tenantId}
        AND eventName = 'PAGE_DURATION'
        AND occurredAt >= ${range.from}
        AND occurredAt < ${range.to}
        AND pagePath IS NOT NULL
      GROUP BY pagePath
    ) durations ON durations.pagePath = views.pagePath
    ORDER BY views.views DESC, views.pagePath ASC
    LIMIT 20
  `);
}

function queryButtonBreakdown(prisma: PrismaClient, tenantId: string, range: { from: Date; to: Date }) {
  return prisma.$queryRaw<ButtonBreakdownRow[]>(Prisma.sql`
    SELECT
      pagePath,
      JSON_UNQUOTE(JSON_EXTRACT(properties, '$.action')) AS action,
      COUNT(*) AS clicks
    FROM analytics_events
    WHERE tenantId = ${tenantId}
      AND eventName = 'BUTTON_CLICK'
      AND occurredAt >= ${range.from}
      AND occurredAt < ${range.to}
      AND pagePath IS NOT NULL
      AND JSON_EXTRACT(properties, '$.action') IS NOT NULL
    GROUP BY pagePath, JSON_UNQUOTE(JSON_EXTRACT(properties, '$.action'))
    ORDER BY clicks DESC, pagePath ASC, action ASC
    LIMIT 20
  `);
}

function queryProjectFunnel(prisma: PrismaClient, tenantId: string, range: { from: Date; to: Date }) {
  return prisma.$queryRaw<ProjectFunnelRow[]>(Prisma.sql`
    WITH project_scope AS (
      SELECT id
      FROM projects
      WHERE tenantId = ${tenantId}
        AND createdAt >= ${range.from}
        AND createdAt < ${range.to}
    ),
    completed_steps AS (
      SELECT
        a.projectId,
        MAX(CASE JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.currentStepKey'))
          WHEN 'processing' THEN 1
          WHEN 'permissions' THEN 2
          WHEN 'partners' THEN 3
          WHEN 'storage' THEN 4
          WHEN 'rights' THEN 5
          WHEN 'generate' THEN 6
          ELSE 0
        END) AS maxStage
      FROM audit_events a
      INNER JOIN project_scope ps ON ps.id = a.projectId
      WHERE a.action = 'PROJECT_FORM_SAVED'
        AND a.createdAt < ${range.to}
      GROUP BY a.projectId
    ),
    generated_projects AS (
      SELECT DISTINCT gj.projectId
      FROM generation_jobs gj
      INNER JOIN project_scope ps ON ps.id = gj.projectId
      WHERE gj.state = 'SUCCEEDED' AND gj.completedAt < ${range.to}
    ),
    downloaded_projects AS (
      SELECT DISTINCT ae.projectId
      FROM analytics_events ae
      INNER JOIN project_scope ps ON ps.id = ae.projectId
      WHERE ae.tenantId = ${tenantId}
        AND ae.eventName = 'WORD_DOWNLOADED'
        AND ae.occurredAt < ${range.to}
    )
    SELECT
      COUNT(*) AS categorySelected,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 1 THEN 1 ELSE 0 END) AS profileCompleted,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 2 THEN 1 ELSE 0 END) AS processingCompleted,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 3 THEN 1 ELSE 0 END) AS permissionsCompleted,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 4 THEN 1 ELSE 0 END) AS partnersCompleted,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 5 THEN 1 ELSE 0 END) AS storageCompleted,
      SUM(CASE WHEN COALESCE(cs.maxStage, 0) >= 6 THEN 1 ELSE 0 END) AS rightsCompleted,
      SUM(CASE WHEN gp.projectId IS NOT NULL THEN 1 ELSE 0 END) AS generationSucceeded,
      SUM(CASE WHEN dp.projectId IS NOT NULL THEN 1 ELSE 0 END) AS wordDownloaded
    FROM project_scope ps
    LEFT JOIN completed_steps cs ON cs.projectId = ps.id
    LEFT JOIN generated_projects gp ON gp.projectId = ps.id
    LEFT JOIN downloaded_projects dp ON dp.projectId = ps.id
  `);
}
