"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, LockSimple, MagnifyingGlass, MapPin, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BaijianBrand } from "@/components/baijian-brand";
import { appCategoryRegistry, type AppCategory } from "@/src/categories";

export function CategorySelector() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<AppCategory | null>(null);

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

  function selectCategory(category: AppCategory) {
    if (category.availability !== "OPEN") {
      setNotice(category);
      return;
    }
    router.push(`/projects/new/confirmation?category=${encodeURIComponent(category.key)}`);
  }

  return (
    <main className="category-page workspace-v3">
      <header className="category-header">
        <BaijianBrand />
        <nav><Link href="/">产品首页</Link><Link href="/projects">我的项目</Link></nav>
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
              data-analytics-id={`category.${category.key}.select`}
              data-open={category.availability === "OPEN"}
              key={category.key}
              onClick={() => selectCategory(category)}
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
