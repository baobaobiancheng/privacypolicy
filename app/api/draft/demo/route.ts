import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { verifiedMapV1Content } from "@/src/content/map-v1/server-content";
import { buildDraftPlan } from "@/src/domain/draft/export-plan";
import { evaluateExportInvariants, type ActivityFacts } from "@/src/domain/rules";
import { renderDraftDocx } from "@/src/documents/render-draft";
import { FormPayloadSchema, generatePolicyDraft } from "@/src/ai/deepseek";
import { isDomainError } from "@/src/domain/errors";
import { requireDevActor } from "@/src/auth/session";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { authorizeProject, type ProjectAccessRecord } from "@/src/application/authorization";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer } from "@/src/knowledge/readiness";
import { mapCnKnowledgePackage } from "@/src/knowledge/map-cn";

export const runtime = "nodejs";

const DraftInputSchema = FormPayloadSchema;
const DraftMetaSchema = z.object({
  projectId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  generationId: z.string().min(1).max(48),
});

type DraftResponse = { buffer: Buffer; generationId: string; filename: string; model: string; markdown: string; docxBase64: string };

export async function GET() {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }

  try {
    const { buffer, ...rest } = await renderDraftResponse({
      profile: { operatorName: "演示主体", operatorContact: "杭州市西湖区示例地址", productName: "地图导航示例", productVersion: "本地演示", contactEmail: "demo@example.com", rightsEntry: "App 内隐私中心", rightsResponsePeriod: "15 个工作日内回复", minorProcessing: "不面向未成年人，发现后删除", securityMeasures: "访问控制和传输加密", incidentChannel: "隐私联系邮箱", policyEffectiveDate: "2026-08-10", policyUpdateNotice: "App 内公告" },
      selected: ["navigation"],
      confirmedFields: ["navigation.0", "navigation.1", "navigation.2"],
      fieldAnswers: { "navigation.0": "PROCESS", "navigation.1": "PROCESS", "navigation.2": "PROCESS" },
      customFeatures: [],
      customDetails: {},
      activityDetails: { navigation: { purpose: "提供定位和路线规划", retention: "导航结束后删除或去标识化" } },
      additionalNotes: "",
      scopeAnswers: { "single-product": true, "map-primary": true, "single-category": true, "no-cross-border": true },
      supplementAnswers: {
        "third-party-services": { answer: "NO", detail: "" },
        "background-location": { answer: "NO", detail: "" },
      },
    }, `generation-demo-${Date.now().toString(36)}`);
    return NextResponse.json(rest);
  } catch (error) {
    return modelErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isDevPersonaEnabled()) return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  const actor = requireDevActor(request);

  const body = await request.json().catch(() => null);
  const parsed = DraftInputSchema.safeParse(body);
  const meta = DraftMetaSchema.safeParse(body);
  if (!parsed.success || !meta.success) {
    return NextResponse.json({
      code: "INVALID_DRAFT_INPUT",
      details: parsed.success ? undefined : parsed.error.flatten(),
    }, { status: 400 });
  }
  const hasSelected = verifiedMapV1Content.payload.features.some((feature) => parsed.data.selected.includes(feature.key));
  if (!hasSelected) return NextResponse.json({ code: "NO_SELECTED_FEATURE" }, { status: 422 });
  const readiness = evaluateFormalPolicyReadiness(parsed.data);
  if (!readiness.ready) {
    return NextResponse.json({
      code: "FORM_NOT_READY",
      message: "请先完成信息选择和必填补充项，再生成隐私政策草稿。",
      diagnostics: readiness.diagnostics,
    }, { status: 422 });
  }

  await ensureDevUsers();
  const prisma = getPrisma();
  const { projectId, expectedRevision, generationId } = meta.data;

  // 生成前校验该身份对项目有编辑权；鉴权失败返回干净的 403，而不是 500。
  const projectRow = await prisma.project.findUnique({ where: { id: projectId }, include: { access: true } });
  const access: ProjectAccessRecord | null = projectRow
    ? { tenantId: projectRow.tenantId, ownerId: projectRow.ownerId, access: projectRow.access.map((item) => ({ userId: item.userId, role: item.role })) }
    : null;
  try {
    authorizeProject(actor, access, "EDIT");
  } catch (error) {
    if (isDomainError(error)) return modelErrorResponse(error);
    throw error;
  }

  try {
    const claim = await claimSnapshot(prisma, {
      projectId,
      expectedRevision,
      generationId,
      input: parsed.data,
    });
    if (claim.kind === "SUCCEEDED") {
      return NextResponse.json({
        generationId,
        filename: `privacy-policy-${generationId}.docx`,
        model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash",
        markdown: claim.markdown,
        docxBase64: Buffer.from(claim.docx).toString("base64"),
        projectId,
      }, { headers: { "Cache-Control": "no-store", "X-Generation-Reused": "true" } });
    }
    if (claim.kind === "IN_PROGRESS") {
      return NextResponse.json({ code: "GENERATION_IN_PROGRESS", message: "同一份表单正在生成，请勿重复提交。", retryable: true }, { status: 409 });
    }
    const { buffer, ...rest } = await renderDraftResponse(parsed.data, generationId);
    await persistSnapshot(prisma, {
      projectId, expectedRevision, generationId, input: parsed.data,
      state: "SUCCEEDED", markdown: rest.markdown, docx: buffer,
    }).catch(() => {});
    return NextResponse.json({ ...rest, projectId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await persistSnapshot(prisma, {
      projectId, expectedRevision, generationId, input: parsed.data,
      state: "FAILED", failureCode: isDomainError(error) ? error.code : "DOCX_GENERATION_FAILED",
    }).catch(() => {});
    return modelErrorResponse(error);
  }
}

function modelErrorResponse(error: unknown) {
  if (isDomainError(error)) {
    const status = error.code === "MODEL_NOT_CONFIGURED" ? 503 : error.code === "PROJECT_FORBIDDEN" ? 403 : error.code === "FORM_NOT_READY" || error.code === "EXPORT_BLOCKED" ? 422 : 502;
    return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status });
  }
  return NextResponse.json({ code: "DOCX_GENERATION_FAILED", message: "草稿生成失败，请使用同一份表单重新生成。", retryable: true }, { status: 502 });
}

async function renderDraftResponse(input: z.infer<typeof DraftInputSchema>, generationId: string): Promise<DraftResponse> {
  const selectedFeatures = verifiedMapV1Content.payload.features.filter((feature) => input.selected.includes(feature.key));

  const fieldAnswer = (featureKey: string, index: number) => resolveFieldAnswer(input, `${featureKey}.${index}`);
  const activities: ActivityFacts[] = selectedFeatures.map((feature) => ({
    activityKey: `activity-${feature.key}`,
    featureKey: feature.key,
    selected: true,
    // 仅内容地图标记为 required 的字段进入必填校验；可选字段由客户决定是否处理。
    requiredFields: feature.fields.filter((field) => field.required).map((field) => field.key),
    riskCode: feature.riskCode,
    assertions: feature.fields.map((field, index) => ({
      assertionId: `${generationId}-${feature.key}-${field.key}`,
      activityKey: `activity-${feature.key}`,
      fieldKey: field.key,
      value: field.label,
      originType: "CLIENT_ORIGINAL" as const,
      factVerification: fieldAnswer(feature.key, index) === "PROCESS" ? "CLIENT_CONFIRMED" as const : fieldAnswer(feature.key, index) === "NOT_PROCESS" ? "EXCLUDED" as const : "UNCONFIRMED" as const,
      legalReview: "NOT_REQUIRED" as const,
      current: true,
    })),
    purpose: input.activityDetails[feature.key]?.purpose,
    retentionPeriod: input.activityDetails[feature.key]?.retention,
    lawfulBasis: "待内部确认",
  })).concat(input.customFeatures.map((feature) => {
    const details = input.customDetails[feature] ?? { purpose: "", retention: "" };
    return {
      activityKey: `activity-custom-${feature}`,
      featureKey: `custom-${feature}`,
      selected: true,
      requiredFields: ["purpose", "retentionPeriod"],
      riskCode: null,
      assertions: [
        {
          assertionId: `${generationId}-custom-${feature}-purpose`,
          activityKey: `activity-custom-${feature}`,
          fieldKey: "purpose",
          value: details.purpose,
          originType: "CLIENT_ORIGINAL" as const,
          factVerification: details.purpose ? "CLIENT_CONFIRMED" as const : "UNCONFIRMED" as const,
          legalReview: "NOT_REQUIRED" as const,
          current: true,
        },
        {
          assertionId: `${generationId}-custom-${feature}-retention`,
          activityKey: `activity-custom-${feature}`,
          fieldKey: "retentionPeriod",
          value: details.retention,
          originType: "CLIENT_ORIGINAL" as const,
          factVerification: details.retention ? "CLIENT_CONFIRMED" as const : "UNCONFIRMED" as const,
          legalReview: "NOT_REQUIRED" as const,
          current: true,
        },
      ],
      purpose: details.purpose,
      retentionPeriod: details.retention,
      lawfulBasis: "待内部确认",
    };
  }));
  const evaluation = evaluateExportInvariants({
    scope: input.scopeAnswers,
    activities,
    commonFacts: [],
  });
  const plan = buildDraftPlan({
    evaluation,
    assertions: activities.flatMap((activity) => {
      const feature = selectedFeatures.find((item) => item.key === activity.featureKey);
      return activity.assertions.map((assertion) => ({ ...assertion, clauseId: `${activity.activityKey}-${assertion.fieldKey}`, evidenceIds: feature ? fieldEvidence(feature.fields, assertion.fieldKey) : [] }));
    }),
  });
  const generatedDraft = await generatePolicyDraft({
    form: {
      profile: input.profile,
      selected: input.selected,
      customFeatures: input.customFeatures,
      customDetails: input.customDetails,
      activityDetails: input.activityDetails,
      confirmedFields: input.confirmedFields,
      fieldAnswers: input.fieldAnswers,
      additionalNotes: input.additionalNotes,
      scopeAnswers: input.scopeAnswers,
      supplementAnswers: input.supplementAnswers,
    },
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    knowledgeContext: {
      packageVersion: mapCnKnowledgePackage.contentVersion,
      packageHash: mapCnKnowledgePackage.packageHash,
      ruleSummary: mapCnKnowledgePackage.sources.map((source) => `${source.id}:${source.role}`),
    },
    selectedFeatures: selectedFeatures.map((feature) => ({
      key: feature.key,
      title: feature.title,
      summary: feature.summary,
      fields: feature.fields.filter((_, index) => fieldAnswer(feature.key, index) === "PROCESS").map((field) => ({ key: field.key, label: field.label, confirmed: true })),
    })),
    allowedFactKeys: [
      ...selectedFeatures.flatMap((feature) => feature.fields.filter((_, index) => fieldAnswer(feature.key, index) === "PROCESS").map((field) => `${feature.key}.${field.key}`)),
      ...input.selected.flatMap((key) => [`activityDetails.${key}.purpose`, `activityDetails.${key}.retention`]),
      ...input.customFeatures.flatMap((key) => [`customDetails.${key}.purpose`, `customDetails.${key}.retention`]),
      ...Object.keys(input.profile),
      ...Object.keys(input.profile).map((key) => `profile.${key}`),
      ...Object.keys(input.supplementAnswers).map((key) => `supplementAnswers.${key}.detail`),
      ...verifiedMapV1Content.payload.commonDisclosureFields.map((field) => field.key),
      ...input.customFeatures,
      "additionalNotes",
    ],
    confirmedFactKeys: [
      ...selectedFeatures.flatMap((feature) => feature.fields.flatMap((field, index) => fieldAnswer(feature.key, index) === "PROCESS" ? [`${feature.key}.${field.key}`] : [])),
      ...input.selected.flatMap((key) => [`activityDetails.${key}.purpose`, `activityDetails.${key}.retention`]),
      ...input.customFeatures.flatMap((key) => [`customDetails.${key}.purpose`, `customDetails.${key}.retention`]),
      ...Object.keys(input.profile),
      ...Object.keys(input.profile).map((key) => `profile.${key}`),
      ...Object.entries(input.supplementAnswers).flatMap(([key, answer]) => answer.answer === "YES" && answer.detail ? [`supplementAnswers.${key}.detail`] : []),
      "additionalNotes",
    ],
    pendingFacts: [],
    referenceStructure: [
      { id: "overview", title: "政策概述", summary: "说明运营主体、产品、适用范围和版本。" },
      { id: "collection_and_use", title: "我们如何收集和使用个人信息", summary: "按处理活动说明目的、字段和使用场景。" },
      { id: "retention", title: "保存期限", summary: "披露客户填写的保存期限规则。" },
      { id: "rights", title: "用户权利", summary: "使用客户填写的权利请求入口和响应信息，不补写客户未填写的承诺。" },
      { id: "third_parties", title: "委托、共享与第三方", summary: "仅在客户事实中出现时披露，不得凭参考政策推断第三方。" },
      { id: "security", title: "安全措施", summary: "只写客户确认的安全事实，不能自动承诺不存在的措施。" },
      { id: "minors", title: "未成年人信息", summary: "缺少客户事实时保留待确认项。" },
      { id: "updates_and_contact", title: "政策更新与联系我们", summary: "使用客户填写的联系和更新信息。" },
    ],
  });
  const buffer = await renderDraftDocx(plan, {
    operatorName: input.profile.operatorName || "[[待确认:运营主体]]",
    productName: input.profile.productName || "[[待确认:产品名称]]",
    productVersion: input.profile.productVersion || "[[待确认:产品版本]]",
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    model: generatedDraft.model,
  }, generatedDraft);

  return {
    buffer,
    generationId,
    filename: `privacy-policy-${generationId}.docx`,
    model: generatedDraft.model,
    markdown: generatedDraft.markdown,
    docxBase64: buffer.toString("base64"),
  };
}

async function persistSnapshot(prisma: PrismaClient, args: {
  projectId: string;
  expectedRevision: number;
  generationId: string;
  input: unknown;
  state: "SUCCEEDED" | "FAILED";
  markdown?: string;
  docx?: Buffer;
  failureCode?: string;
}) {
  const content = verifiedMapV1Content;
  const inputHash = `sha256:${createHash("sha256").update(JSON.stringify(args.input)).digest("hex")}`;
  const docxHash = args.docx ? `sha256:${createHash("sha256").update(args.docx).digest("hex")}` : null;
  await prisma.draftSnapshot.upsert({
    where: { projectId_idempotencyKey: { projectId: args.projectId, idempotencyKey: args.generationId } },
    create: {
      id: `snap-${args.generationId}`,
      projectId: args.projectId,
      projectRevision: args.expectedRevision,
      idempotencyKey: args.generationId,
      templateHash: content.contentHash,
      contentVersion: content.contentVersion,
      inputHash,
      inputJson: args.input as Prisma.InputJsonValue,
      state: args.state,
      markdown: args.markdown ?? null,
      docx: (args.docx ?? null) as unknown as Uint8Array<ArrayBuffer>,
      docxHash,
      failureCode: args.failureCode ?? null,
    },
    update: {
      state: args.state,
      inputJson: args.input as Prisma.InputJsonValue,
      markdown: args.markdown ?? null,
      docx: (args.docx ?? null) as unknown as Uint8Array<ArrayBuffer>,
      docxHash,
      failureCode: args.failureCode ?? null,
      leaseExpiresAt: null,
    },
  });
}

async function claimSnapshot(prisma: PrismaClient, args: {
  projectId: string;
  expectedRevision: number;
  generationId: string;
  input: unknown;
}): Promise<{ kind: "CLAIMED" } | { kind: "IN_PROGRESS" } | { kind: "SUCCEEDED"; markdown: string; docx: Uint8Array }> {
  const inputHash = `sha256:${createHash("sha256").update(JSON.stringify(args.input)).digest("hex")}`;
  const leaseExpiresAt = new Date(Date.now() + 5 * 60_000);
  try {
    await prisma.draftSnapshot.create({
      data: {
        id: `snap-${args.generationId}`,
        projectId: args.projectId,
        projectRevision: args.expectedRevision,
        idempotencyKey: args.generationId,
        templateHash: verifiedMapV1Content.contentHash,
        contentVersion: verifiedMapV1Content.contentVersion,
        inputHash,
        inputJson: args.input as Prisma.InputJsonValue,
        state: "GENERATING",
        leaseExpiresAt,
      },
    });
    return { kind: "CLAIMED" };
  } catch {
    const existing = await prisma.draftSnapshot.findUnique({
      where: { projectId_idempotencyKey: { projectId: args.projectId, idempotencyKey: args.generationId } },
    });
    if (!existing) throw new Error("生成租约创建失败");
    if (existing.inputHash !== inputHash) return { kind: "IN_PROGRESS" };
    if (existing.state === "SUCCEEDED" && existing.markdown && existing.docx) {
      return { kind: "SUCCEEDED", markdown: existing.markdown, docx: existing.docx };
    }

    const now = new Date();
    const reclaimable = existing.state === "FAILED" || (existing.state === "GENERATING" && existing.leaseExpiresAt !== null && existing.leaseExpiresAt <= now);
    if (!reclaimable) return { kind: "IN_PROGRESS" };
    const reclaimed = await prisma.draftSnapshot.updateMany({
      where: {
        id: existing.id,
        state: existing.state,
        ...(existing.state === "GENERATING" ? { leaseExpiresAt: { lte: now } } : {}),
      },
      data: { state: "GENERATING", leaseExpiresAt, failureCode: null, markdown: null, docx: null, docxHash: null },
    });
    return reclaimed.count === 1 ? { kind: "CLAIMED" } : { kind: "IN_PROGRESS" };
  }
}

function fieldEvidence(fields: Array<{ key: string; sourceRefs: string[] }>, fieldKey: string): string[] {
  return fields.find((field) => field.key === fieldKey)?.sourceRefs ?? [];
}
