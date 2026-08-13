"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck } from "@phosphor-icons/react";

type ProjectSummary = { id: string; name: string; revision: number; scopeStop: string | undefined };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch("/api/projects", { headers: { "x-persona-id": "client-editor" } })
      .then(async (res) => {
        if (!res.ok) throw new Error("加载项目列表失败");
        const payload = await res.json() as { projects: ProjectSummary[] };
        return payload.projects ?? [];
      })
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  return (
    <main className="project-list-page">
      <header className="project-list-header"><Link href="/" className="brand"><span className="brand-mark"><ShieldCheck weight="fill" /></span><span>知证</span></Link><span>项目列表</span></header>
          <section className="project-list-content"><p className="hero-kicker">项目工作区</p><h1>从一个真实产品事实开始。</h1><p>地图导航类首期只保存你明确提交过的答案。没有提交范围答案时，不会创建空项目。</p><Link className="button button-primary" href="/projects/new/scope">创建地图类项目 <ArrowRight weight="bold" /></Link><div className="project-cards">{projects.map((project) => <Link className="project-empty-card" key={project.id} href={`/projects/${project.id}/scope`}><span className="project-icon"><MapPin weight="fill" /></span><div><strong>{project.name}</strong><span>{project.scopeStop ? "暂存：不适用地图类首期" : `项目修订号 ${project.revision}`}</span></div><ArrowRight weight="bold" /></Link>)}{projects.length === 0 && <div className="project-empty-card"><span className="project-icon"><MapPin weight="fill" /></span><div><strong>地图导航类首期试点</strong><span>提交范围门禁后会出现在这里</span></div></div>}</div></section>
    </main>
  );
}
