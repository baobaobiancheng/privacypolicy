import { getPrisma } from "../src/data/prisma";
import { clearAnalyticsSummaryCache, getAnalyticsSummary } from "../src/analytics/server";
import { projectListSelect } from "../src/data/project-list-query";

const TENANT_ID = "perf-benchmark-tenant";
const USER_ID = "perf-benchmark-user";
const PROJECT_COUNT = 1_000;
const EVENTS_PER_PROJECT = 100;
const INSERT_BATCH_SIZE = 1_000;
const HASH = `sha256:${"0".repeat(64)}`;
const FORM_DATA = {
  schemaVersion: "privacy-form-v2.0.0",
  profile: {},
  additionalNotes: "",
  supplementAnswers: {},
  processingActivities: [],
  permissions: [],
  partners: [],
  storageAndSecurity: { locations: [], retentionPolicies: [], expiryActions: [], securityMeasures: [] },
  rightsAndGovernance: {},
  attachments: [],
};

async function main() {
  if (process.env.RUN_PERFORMANCE_BENCHMARK !== "1") {
    throw new Error("Set RUN_PERFORMANCE_BENCHMARK=1 to create the isolated benchmark tenant.");
  }
  const prisma = getPrisma();
  const startedAt = new Date(Date.now() - 60_000);
  await clearExistingDataset();
  await prisma.user.create({ data: {
    id: USER_ID,
    tenantId: TENANT_ID,
    displayName: "Performance benchmark",
    role: "CLIENT_EDITOR",
  } });
  await prisma.project.createMany({ data: Array.from({ length: PROJECT_COUNT }, (_, index) => ({
    id: projectId(index),
    tenantId: TENANT_ID,
    ownerId: USER_ID,
    creationKey: `perf-${index}`,
    name: `Performance project ${index}`,
    productName: `Performance product ${index}`,
    revision: 5,
    contentVersion: "map-v1.0.0",
    contentHash: HASH,
    currentStepKey: "generate",
    progressPercent: 100,
    formData: FORM_DATA,
    createdAt: startedAt,
    updatedAt: startedAt,
  })) });
  await prisma.generationJob.createMany({ data: Array.from({ length: PROJECT_COUNT }, (_, index) => ({
    id: `gen_perf_${index}`,
    projectId: projectId(index),
    requestedById: USER_ID,
    projectRevision: 5,
    idempotencyKey: `perf-generation-${index}`,
    inputHash: HASH,
    inputJson: { schemaVersion: "privacy-form-v2.0.0", projectRevision: 5, formData: FORM_DATA },
    state: index % 10 === 0 ? "FAILED" as const : "SUCCEEDED" as const,
    stage: "COMPLETED" as const,
    attemptCount: 1,
    nextAttemptAt: startedAt,
    startedAt,
    completedAt: new Date(startedAt.getTime() + 20_000 + index),
    createdAt: startedAt,
    updatedAt: startedAt,
  })) });
  const auditRows = Array.from({ length: PROJECT_COUNT }, (_, index) => Array.from({ length: 5 }, (_unused, stage) => ({
    id: `aud_perf_${index}_${stage}`,
    projectId: projectId(index),
    userId: USER_ID,
    action: "PROJECT_FORM_SAVED",
    metadata: { currentStepKey: ["processing", "permissions", "partners", "storage", "generate"][stage] },
    createdAt: startedAt,
  }))).flat();
  await prisma.auditEvent.createMany({ data: auditRows });

  for (let offset = 0; offset < PROJECT_COUNT * EVENTS_PER_PROJECT; offset += INSERT_BATCH_SIZE) {
    const rows = Array.from({ length: Math.min(INSERT_BATCH_SIZE, PROJECT_COUNT * EVENTS_PER_PROJECT - offset) }, (_unused, localIndex) => {
      const index = offset + localIndex;
      const event = index % 20 === 0 ? "WORD_DOWNLOADED" : index % 3 === 0 ? "PAGE_DURATION" : index % 3 === 1 ? "BUTTON_CLICK" : "PAGE_VIEW";
      return {
        id: `evt_perf_${index}`,
        tenantId: TENANT_ID,
        userId: USER_ID,
        projectId: projectId(index % PROJECT_COUNT),
        sessionId: `session-${index % 200}`,
        eventName: event,
        pagePath: `/projects/${projectId(index % PROJECT_COUNT)}/profile`,
        durationMs: event === "PAGE_DURATION" ? 30_000 + index % 10_000 : null,
        properties: event === "BUTTON_CLICK" ? { action: `action-${index % 20}` } : undefined,
        occurredAt: startedAt,
        createdAt: startedAt,
      };
    });
    await prisma.analyticsEvent.createMany({ data: rows });
  }

  clearAnalyticsSummaryCache();
  const summaryMs = await measure(async () => getAnalyticsSummary(
    { userId: USER_ID, tenantId: TENANT_ID, role: "CLIENT_EDITOR" },
    { from: new Date(startedAt.getTime() - 1_000), to: new Date() },
    prisma,
  ));
  const projectListMs = await measure(() => prisma.project.findMany({
    where: { tenantId: TENANT_ID },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: projectListSelect,
  }));
  console.info(JSON.stringify({
    level: "info",
    event: "api_query_benchmark_completed",
    dataset: { projects: PROJECT_COUNT, analyticsEvents: PROJECT_COUNT * EVENTS_PER_PROJECT },
    timingsMs: { analyticsSummary: summaryMs, projectList20: projectListMs },
  }));
  if (process.env.PERFORMANCE_KEEP_DATA !== "1") await clearExistingDataset();
  await prisma.$disconnect();

  async function clearExistingDataset() {
    await prisma.analyticsEvent.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.project.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  }
}

function projectId(index: number) {
  return `prj_perf_${index}`;
}

async function measure<T>(operation: () => Promise<T>): Promise<number> {
  const started = performance.now();
  await operation();
  return Math.round((performance.now() - started) * 100) / 100;
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", event: "api_query_benchmark_failed", error: String(error) }));
  process.exitCode = 1;
});
