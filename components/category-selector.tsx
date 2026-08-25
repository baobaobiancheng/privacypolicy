"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle, LockSimple, MagnifyingGlass, MapPin, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { BaijianBrand } from "@/components/baijian-brand";
import { appCategoryRegistry, type AppCategory } from "@/src/categories";

const PERSONA_ID = "client-editor";
const CREATE_TIMEOUT_MS = 15_000;
const NAVIGATION_FALLBACK_MS = 2_500;

function createProjectIdempotencyKey() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `project-create-${random}`;
}

export function CategorySelector() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<AppCategory | null>(null);
  const [error, setError] = useState("");
  const creationKeyRef = useRef<string | null>(null);
  const navigationFallbackRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (navigationFallbackRef.current !== null) window.clearTimeout(navigationFallbackRef.current);
  }, []);

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return appCategoryRegistry.groups;
    return appCategoryRegistry.groups
      .map((group) => ({
        ...group,
        categories: group.categories.filter((category) =>
          [category.label, category.basicFunction, category.necessaryInfoSummary].some((value) => value.toLowerCase().includes(keyword)),
        ),
      }))
      .filter((group) => group.categories.length > 0);
  }, [query]);

  async function selectCategory(category: AppCategory) {
    setError("");
    if (category.availability !== "OPEN") {
      setNotice(category);
      return;
    }
    setCreating(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);
    creationKeyRef.current ??= createProjectIdempotencyKey();
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json", "x-persona-id": PERSONA_ID },
        body: JSON.stringify({ categoryKey: category.key, idempotencyKey: creationKeyRef.current }),
        signal: controller.signal,
      });
      const payload = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.id) throw new Error(payload.error?.message || "项目创建失败，请稍后重试。");
      const target = `/projects/${payload.data.id}/profile`;
      router.push(target);
      navigationFallbackRef.current = window.setTimeout(() => {
        window.location.assign(target);
      }, NAVIGATION_FALLBACK_MS);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "AbortError"
        ? "创建请求等待时间过长，请重试；系统不会重复创建项目。"
        : cause instanceof Error ? cause.message : "项目创建失败，请稍后重试。");
      setCreating(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <main className="category-page workspace-v3">
      <header className="category-header">
        <BaijianBrand />
        <nav><a href="/">产品首页</a><a href="/projects">我的项目</a></nav>
      </header>
      <section className="category-hero">
        <p className="hero-kicker">新建隐私政策项目</p>
        <h1>选择产品的主要类别</h1>
        <p>请按产品的主要基本功能选择类别；其他附加功能可在后续继续添加。</p>
        <label className="category-search">
          <MagnifyingGlass weight="bold" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 39 类应用，例如：地图、购物、直播" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X weight="bold" /></button> : null}
        </label>
      </section>

      <section className="category-groups" aria-label="应用类别">
        {groups.map((group) => <section className="category-group" key={group.key}>
          <div className="category-group-heading"><h2>{group.label}</h2><span>{group.categories.length} 类</span></div>
          <div className="category-grid">
            {group.categories.map((category) => <button
              type="button"
              className="category-card"
              data-open={category.availability === "OPEN"}
              disabled={creating}
              key={category.key}
              onClick={() => void selectCategory(category)}
            >
              <span className="category-card-icon" aria-hidden="true">{category.key === "map-navigation" ? <MapPin weight="fill" /> : <LockSimple weight="bold" />}</span>
              <span className="category-card-copy">
                <span><strong>{category.label}</strong><em>{category.availability === "OPEN" ? <><CheckCircle weight="fill" /> 已开放</> : "即将开放"}</em></span>
                <small>{category.basicFunction}</small>
                <small>必要信息参考：{category.necessaryInfoSummary}</small>
              </span>
              <ArrowRight weight="bold" />
            </button>)}
          </div>
        </section>)}
        {groups.length === 0 ? <div className="category-empty">没有找到相关类别，请尝试搜索产品的主要功能。</div> : null}
      </section>
      {error ? <div className="category-error" role="alert">{error}</div> : null}

      {notice ? <div className="category-modal-backdrop" role="presentation" onClick={() => setNotice(null)}>
        <section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="category-modal-close" onClick={() => setNotice(null)} aria-label="关闭"><X weight="bold" /></button>
          <span className="category-modal-icon" aria-hidden="true"><LockSimple weight="bold" /></span>
          <p>类别能力建设中</p>
          <h2 id="category-modal-title">{notice.label}即将开放</h2>
          <span>当前首期仅开放地图导航类。该类别的行业问卷、必要信息规则和报告模板完成验证后即可创建项目。</span>
          <button type="button" className="button button-primary" onClick={() => setNotice(null)}>我知道了</button>
        </section>
      </div> : null}
    </main>
  );
}
