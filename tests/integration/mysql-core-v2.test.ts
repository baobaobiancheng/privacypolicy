import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import mariadb, { type Pool } from "mariadb";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FORM_SCHEMA_VERSION, ProjectFormDataSchema } from "@/src/workspace/contract";
import { DomainError } from "@/src/domain/errors";

const baseConnection = process.env.RUN_MYSQL_INTEGRATION === "1"
  ? (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)?.trim()
  : undefined;
const integration = baseConnection ? describe : describe.skip;

integration("MySQL core v2 API and worker", () => {
  let admin: Pool;
  let prisma: PrismaClient;
  let databaseName: string;
  let databaseUrl: string;

  beforeAll(async () => {
    const url = new URL(baseConnection!);
    databaseName = `privacy_policy_it_${process.pid}_${Date.now()}`;
    admin = mariadb.createPool({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      connectionLimit: 2,
    });
    await admin.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
    process.env.DATABASE_URL = databaseUrl;

    const migration = readdirSync(resolve("prisma/migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve("prisma/migrations", entry.name, "migration.sql"))
      .sort()
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
      .replace(/^--.*$/gm, "")
      .split(/;\s*(?:\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    const connection = await admin.getConnection();
    try {
      await connection.query(`USE \`${databaseName}\``);
      for (const statement of migration) await connection.query(statement);
    } finally {
      connection.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaMariaDb({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: databaseName,
      connectionLimit: 3,
    }) });
  }, 30_000);

  afterAll(async () => {
    const { getPrisma } = await import("@/src/data/prisma");
    await getPrisma().$disconnect().catch(() => undefined);
    await prisma?.$disconnect();
    if (admin && databaseName) await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await admin?.end();
  }, 30_000);

  it("creates, lists and updates a project through the v1 API with optimistic concurrency", async () => {
    const { POST, GET } = await import("@/app/api/v1/projects/route");
    const createResponse = await POST(new Request("http://localhost/api/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", "x-persona-id": "client-editor" },
      body: JSON.stringify({
        categoryKey: "map-navigation",
        idempotencyKey: "integration-project-create-1",
        usageConfirmation: { accepted: true, version: "privacy-policy-usage-v1" },
      }),
    }));
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { data: { id: string; revision: number } };
    expect(created.data.id).toMatch(/^prj_/);

    const repeatedCreateResponse = await POST(new Request("http://localhost/api/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", "x-persona-id": "client-editor" },
      body: JSON.stringify({
        categoryKey: "map-navigation",
        idempotencyKey: "integration-project-create-1",
        usageConfirmation: { accepted: true, version: "privacy-policy-usage-v1" },
      }),
    }));
    expect(repeatedCreateResponse.status).toBe(200);
    const repeatedProject = await repeatedCreateResponse.json() as { data: { id: string; reused: boolean } };
    expect(repeatedProject.data).toMatchObject({ id: created.data.id, reused: true });

    const listResponse = await GET(new Request("http://localhost/api/v1/projects?limit=1", { headers: { "x-persona-id": "client-editor" } }));
    const list = await listResponse.json() as { data: { items: Array<{ id: string }>; nextCursor: string | null } };
    expect(list.data.items.map((item) => item.id)).toContain(created.data.id);

    const detailRoute = await import("@/app/api/v1/projects/[projectId]/route");
    const formData = ProjectFormDataSchema.parse({
      schemaVersion: FORM_SCHEMA_VERSION,
      profile: { productName: "集成测试地图" },
    });
    const save = (expectedRevision: number) => detailRoute.PUT(new Request(`http://localhost/api/v1/projects/${created.data.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-persona-id": "client-editor" },
      body: JSON.stringify({ expectedRevision, formData, currentStepKey: "profile" }),
    }), { params: Promise.resolve({ projectId: created.data.id }) });
    expect((await save(0)).status).toBe(200);
    expect((await save(0)).status).toBe(409);
    expect(await prisma.auditEvent.count({ where: { projectId: created.data.id } })).toBe(2);
    const creationAudit = await prisma.auditEvent.findFirst({
      where: { projectId: created.data.id, action: "PROJECT_CREATED" },
      select: { metadata: true },
    });
    expect(creationAudit?.metadata).toMatchObject({
      usageConfirmationVersion: "privacy-policy-usage-v1",
    });
  });

  it("runs an idempotent job and marks a stale report superseded", async () => {
    const { enqueueGeneration, getGeneration, processNextGenerationJob } = await import("@/src/application/generation/job-service");
    const actor = { userId: "demo-client", tenantId: "demo-tenant", role: "CLIENT_EDITOR" as const };
    const project = await prisma.project.findFirstOrThrow({ where: { tenantId: actor.tenantId } });
    const first = await enqueueGeneration(prisma, actor, project.id, "integration-idempotency-1");
    const repeated = await enqueueGeneration(prisma, actor, project.id, "integration-idempotency-1");
    const repeatedFromAnotherWindow = await enqueueGeneration(prisma, actor, project.id, "integration-idempotency-2");
    expect(repeated.job.id).toBe(first.job.id);
    expect(repeated.reused).toBe(true);
    expect(repeatedFromAnotherWindow.job.id).toBe(first.job.id);
    expect(repeatedFromAnotherWindow.reused).toBe(true);

    await prisma.project.update({ where: { id: project.id }, data: { revision: { increment: 1 } } });
    const processed = await processNextGenerationJob(prisma, "integration-worker", {
      generatePolicy: async (_reportId, formData) => {
        const markdown = "# 集成测试隐私政策\n\n" + "正式正文。".repeat(30);
        const docx = Buffer.from("PK-test-docx");
        return {
          filename: "集成测试隐私政策.docx",
          markdown,
          docx,
          model: "mock",
          inputHash: `sha256:${createHash("sha256").update(JSON.stringify(formData)).digest("hex")}`,
        };
      },
    });
    expect(processed).toBe(true);
    const completed = await getGeneration(prisma, actor, project.id, first.job.id);
    expect(completed.state).toBe("SUPERSEDED");
    expect(completed.reportId).toMatch(/^rpt_/);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: completed.reportId! } });
    expect(report.state).toBe("SUPERSEDED");
    expect(report.docx?.byteLength).toBeGreaterThan(0);
    expect(await prisma.auditEvent.count({ where: { projectId: project.id, action: "GENERATION_SUPERSEDED" } })).toBe(1);
  });

  it("does not commit a report after another worker takes over the lease", async () => {
    const { enqueueGeneration, processNextGenerationJob } = await import("@/src/application/generation/job-service");
    const actor = { userId: "demo-client", tenantId: "demo-tenant", role: "CLIENT_EDITOR" as const };
    const project = await prisma.project.findFirstOrThrow({ where: { tenantId: actor.tenantId } });
    const queued = await enqueueGeneration(prisma, actor, project.id, "integration-lease-takeover");
    let generationStarted!: () => void;
    const started = new Promise<void>((resolve) => { generationStarted = resolve; });
    let externalRequestAborted = false;
    const processing = processNextGenerationJob(prisma, "worker-that-loses-lease", {
      heartbeatMs: 20,
      generatePolicy: async (_reportId, _formData, _categoryKey, callbacks) => {
        generationStarted();
        const signal = callbacks?.signal;
        if (!signal) throw new Error("worker did not pass an abort signal");
        await new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => {
          externalRequestAborted = true;
          reject(signal.reason);
        }, { once: true }));
        throw new Error("unreachable");
      },
    });
    await started;
    await prisma.generationJob.update({
      where: { id: queued.job.id },
      data: { leaseOwner: "replacement-worker", leaseExpiresAt: new Date(Date.now() + 90_000) },
    });
    await processing;

    expect(externalRequestAborted).toBe(true);
    expect(await prisma.report.count({ where: { generationId: queued.job.id } })).toBe(0);
    expect(await prisma.generationJob.findUniqueOrThrow({ where: { id: queued.job.id } })).toMatchObject({
      state: "RUNNING",
      leaseOwner: "replacement-worker",
    });
  });

  it("requeues retryable failures with a future next-attempt time", async () => {
    const { enqueueGeneration, processNextGenerationJob } = await import("@/src/application/generation/job-service");
    const actor = { userId: "demo-client", tenantId: "demo-tenant", role: "CLIENT_EDITOR" as const };
    const project = await prisma.project.findFirstOrThrow({ where: { tenantId: actor.tenantId } });
    const queued = await enqueueGeneration(prisma, actor, project.id, "integration-retry-backoff");
    const before = Date.now();
    await processNextGenerationJob(prisma, "integration-retry-worker", {
      generatePolicy: async () => {
        throw new DomainError("MODEL_REQUEST_FAILED", "provider unavailable", { retryable: true });
      },
    });
    const retried = await prisma.generationJob.findUniqueOrThrow({ where: { id: queued.job.id } });
    expect(retried).toMatchObject({ state: "QUEUED", attemptCount: 1, leaseOwner: null });
    expect(retried.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + 24_000);
  });

  it("persists structured preflight failures for the client review screen", async () => {
    const { enqueueGeneration, getGeneration, processNextGenerationJob } = await import("@/src/application/generation/job-service");
    const actor = { userId: "demo-client", tenantId: "demo-tenant", role: "CLIENT_EDITOR" as const };
    const project = await prisma.project.findFirstOrThrow({ where: { tenantId: actor.tenantId } });
    const queued = await enqueueGeneration(prisma, actor, project.id, "integration-preflight-details");
    await processNextGenerationJob(prisma, "integration-worker-preflight", {
      generatePolicy: async () => {
        throw new DomainError("FORM_SEMANTIC_REVIEW_REQUIRED", "生成前发现需要核对的产品事实。", {
          retryable: false,
          details: { issues: [{ id: "conflict-1", severity: "BLOCKING", category: "CONTRADICTION", title: "信息冲突", description: "同一信息存在冲突。", targetStep: "review", relatedPaths: ["storageAndSecurity.fixedPeriod"], questionForUser: "请确认实际保存期限。" }] },
        });
      },
    });
    const failed = await getGeneration(prisma, actor, project.id, queued.job.id);
    expect(failed.state).toBe("FAILED");
    expect(failed.error).toMatchObject({
      code: "FORM_SEMANTIC_REVIEW_REQUIRED",
      details: { issues: [{ id: "conflict-1" }] },
    });
    expect(await prisma.auditEvent.count({ where: { projectId: project.id, action: "GENERATION_FAILED" } })).toBe(1);

    const issue = (failed.error?.details as { issues: Array<{ id: string; category: string; relatedPaths: string[] }> }).issues[0];
    const fingerprint = JSON.stringify([issue.id, issue.category, [...issue.relatedPaths].sort()]);
    const confirmed = await enqueueGeneration(
      prisma,
      actor,
      project.id,
      "integration-preflight-confirmed",
      undefined,
      { acknowledgedPreflightIssues: [fingerprint] },
    );
    expect(confirmed.reused).toBe(false);
    const confirmedInput = await prisma.generationJob.findUniqueOrThrow({ where: { id: confirmed.job.id }, select: { inputJson: true } });
    expect(confirmedInput.inputJson).toMatchObject({ acknowledgedPreflightIssues: [fingerprint] });
  });
});
