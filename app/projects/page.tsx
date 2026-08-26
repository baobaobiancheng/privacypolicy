"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, FileDoc, MapPin, Plus, SpinnerGap } from "@phosphor-icons/react";
import { BaijianBrand } from "@/components/baijian-brand";

type ProjectSummary = {
  id: string;
  name: string;
  productName: string | null;
  categoryLabel: string;
  progress: number;
  status: string;
  currentStepKey: string;
  updatedAt: string;
  latestReport: { id: string; createdAt: string; previewUrl: string; downloadUrl: string } | null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const query = cursor ? `?limit=20&cursor=${encodeURIComponent(cursor)}` : "?limit=20";
      const response = await fetch(`/api/v1/projects${query}`, { headers: { "x-persona-id": "client-editor" } });
      if (!response.ok) throw new Error("加载项目列表失败，请稍后重试");
      const payload = await response.json() as { data: { items: ProjectSummary[]; nextCursor: string | null } };
      setProjects((current) => cursor ? [...current, ...payload.data.items] : payload.data.items);
      setNextCursor(payload.data.nextCursor);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载项目列表失败，请稍后重试");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // Initial API synchronization; subsequent pages are loaded by explicit user action.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, [loadProjects]);

  return <main className="project-list-page workspace-v3">
    <header className="project-list-header"><BaijianBrand /><span>我的项目</span></header>
    <section className="project-list-content">
      <div className="project-list-title-row"><div><p className="hero-kicker">隐私政策项目</p><h1>保存每一次事实收集。</h1><p>继续填写历史项目，回看已确认信息，或下载最新生成的隐私政策。</p></div><Link className="button button-primary" data-analytics-id="projects.create" href="/projects/new/category"><Plus weight="bold" /> 新建项目</Link></div>
      {loading ? <div className="project-list-loading"><SpinnerGap className="spin" /> 正在加载项目…</div> : <div className="project-cards">
        {projects.map((project) => <Link className="project-card-v2" key={project.id} href={`/projects/${project.id}`}>
          <span className="project-icon"><MapPin weight="fill" /></span>
          <div className="project-card-main"><div><span>{project.categoryLabel}类</span>{project.latestReport ? <em><CheckCircle weight="fill" /> 已生成报告</em> : <em>信息收集中</em>}</div><strong>{project.productName || project.name}</strong><small>更新于 {new Date(project.updatedAt).toLocaleString("zh-CN")}</small><div className="project-progress"><span><i style={{ width: `${project.progress}%` }} /></span><b>{project.progress}%</b></div></div>
          <span className="project-card-action">{project.latestReport ? <FileDoc weight="duotone" /> : null}<ArrowRight weight="bold" /></span>
        </Link>)}
        {loadError && projects.length === 0 ? <div className="project-list-empty"><strong>项目暂时无法加载</strong><span>{loadError}</span><button className="button button-secondary" type="button" onClick={() => void loadProjects()}>重新加载</button></div> : null}
        {!loadError && projects.length === 0 ? <div className="project-list-empty"><MapPin weight="duotone" /><strong>还没有项目</strong><span>选择应用类别后，项目会自动保存在这里。</span><Link className="button button-primary" data-analytics-id="projects.create_first" href="/projects/new/category">创建第一个项目</Link></div> : null}
        {nextCursor ? <button className="button button-secondary project-load-more" type="button" disabled={loadingMore} onClick={() => void loadProjects(nextCursor)}>{loadingMore ? <><SpinnerGap className="spin" /> 正在加载</> : "加载更多项目"}</button> : null}
      </div>}
    </section>
  </main>;
}
