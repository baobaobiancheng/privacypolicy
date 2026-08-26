"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, DownloadSimple, FileDoc, PencilSimple, SpinnerGap } from "@phosphor-icons/react";
import { BaijianBrand } from "@/components/baijian-brand";
import { ProjectFormDataSchema, parseWorkspaceStep, type ProjectFormData } from "@/src/workspace/contract";

type ProjectResponse = {
  id: string;
  name: string;
  productName: string | null;
  categoryLabel: string;
  currentStepKey: string;
  status: string;
  revision: number;
  formData: ProjectFormData | null;
  latestReport: { id: string; createdAt: string; previewUrl: string; downloadUrl: string } | null;
};

const PERSONA_ID = "client-editor";

function readable(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join("、");
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(readable).filter(Boolean).join("；");
  return "";
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}`, { headers: { "x-persona-id": PERSONA_ID } })
      .then(async (response) => {
        if (!response.ok) throw new Error("项目加载失败");
        return response.json().then((payload: { data: ProjectResponse }) => payload.data);
      })
      .then(setProject)
      .catch(() => setFailed(true));
  }, [projectId]);

  const continueSlug = useMemo(() => {
    if (!project) return "profile";
    return parseWorkspaceStep(project.currentStepKey) === null ? "profile" : project.currentStepKey;
  }, [project]);

  if (failed) return <main className="project-overview-page"><div className="project-overview-state">项目不存在或暂时无法加载。</div></main>;
  if (!project) return <main className="project-overview-page"><div className="project-overview-state"><SpinnerGap className="spin" /> 正在加载项目…</div></main>;

  const form: ProjectFormData = project.formData ?? ProjectFormDataSchema.parse({ schemaVersion: "privacy-form-v2.0.0" });
  const sections = [
    { label: "基本信息", slug: "profile", text: readable(form.profile) },
    { label: "功能与个人信息", slug: "processing", text: readable(form.processingActivities) },
    { label: "设备权限", slug: "permissions", text: readable(form.permissions) },
    { label: "SDK 与合作方", slug: "partners", text: readable(form.partners) },
    { label: "存储与安全", slug: "storage", text: readable(form.storageAndSecurity) },
    { label: "用户权利", slug: "rights", text: readable(form.rightsAndGovernance) },
    { label: "隐私政策生成", slug: "generate", text: project.latestReport ? "隐私政策已生成，可在线预览或下载 Word" : "尚未生成隐私政策" },
  ];

  return <main className="project-overview-page workspace-v3">
    <header className="project-overview-header"><BaijianBrand /><Link href="/projects"><ArrowLeft weight="bold" /> 我的项目</Link></header>
    <section className="project-overview-hero">
      <div><span className="category-pill">{project.categoryLabel}类</span><h1>{project.productName || project.name}</h1><p>项目修订号 {project.revision} · {project.latestReport ? "已有可下载报告" : "信息收集中"}</p></div>
      <Link className="button button-primary" href={`/projects/${project.id}/${continueSlug}`}>继续填写 <ArrowRight weight="bold" /></Link>
    </section>
    <div className="project-overview-layout">
      <section className="project-overview-facts">
        <div className="project-overview-section-heading"><div><p>项目流程</p><h2>按七个环节回看填写与生成结果</h2></div><span>每一项都可以返回对应环节查看或修改</span></div>
        <div className="overview-fact-list">{sections.map((section, index) => <article key={section.slug}>
          <span>{index + 1}</span><div><strong>{section.label}</strong><p>{section.text || "尚未填写"}</p></div><Link href={`/projects/${project.id}/${section.slug}`}><PencilSimple weight="bold" /> 编辑</Link>
        </article>)}</div>
      </section>
      <aside className="project-overview-report">
        <FileDoc weight="duotone" />
        <p>最新隐私政策</p>
        {project.latestReport ? <>
          <h2>报告已生成</h2>
          <span><CheckCircle weight="fill" /> {new Date(project.latestReport.createdAt).toLocaleString("zh-CN")}</span>
          <Link className="button button-ghost" href={`/projects/${project.id}/generate`}>在线预览</Link>
          <a className="button button-primary" href={project.latestReport.downloadUrl}><DownloadSimple weight="bold" /> 下载 Word</a>
        </> : <><h2>尚未生成报告</h2><span>完成前六个事实收集环节后，在第七环节生成和下载隐私政策。</span><Link className="button button-primary" href={`/projects/${project.id}/${continueSlug}`}>继续填写</Link></>}
      </aside>
    </div>
  </main>;
}
