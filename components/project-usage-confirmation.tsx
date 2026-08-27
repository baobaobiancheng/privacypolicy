"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle, FileText, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BaijianBrand } from "@/components/baijian-brand";
import { createBrowserId } from "@/src/browser/random-id";
import type { AppCategory } from "@/src/categories";
import { clearProjectCreationKey, projectCreationStorage, resolveProjectCreationKey } from "@/src/workspace/project-creation-key";
import { usageConfirmationRequest } from "@/src/workspace/usage-confirmation";

const PERSONA_ID = "client-editor";
const CREATE_TIMEOUT_MS = 15_000;
const NAVIGATION_FALLBACK_MS = 2_500;

function createProjectIdempotencyKey() {
  return `project-create-${createBrowserId()}`;
}

export function ProjectUsageConfirmation({ category }: { category: AppCategory }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const creationKeyRef = useRef<string | null>(null);
  const navigationFallbackRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (navigationFallbackRef.current !== null) window.clearTimeout(navigationFallbackRef.current);
  }, []);

  async function confirmAndCreate() {
    if (!accepted || creating) return;
    setError("");
    setCreating(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);
    const creationStorage = projectCreationStorage();
    creationKeyRef.current = resolveProjectCreationKey(creationStorage, creationKeyRef.current, createProjectIdempotencyKey);

    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json", "x-persona-id": PERSONA_ID },
        body: JSON.stringify({
          categoryKey: category.key,
          idempotencyKey: creationKeyRef.current,
          usageConfirmation: usageConfirmationRequest,
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.id) throw new Error(payload.error?.message || "项目创建失败，请稍后重试。");

      clearProjectCreationKey(creationStorage);
      const target = `/projects/${payload.data.id}/profile`;
      router.push(target);
      navigationFallbackRef.current = window.setTimeout(() => {
        // Hard navigation is an intentional recovery path when the client router stalls.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
    <main className="usage-confirmation-page workspace-v3">
      <header className="category-header">
        <BaijianBrand />
        <nav><Link href="/">产品首页</Link><Link href="/projects">我的项目</Link></nav>
      </header>

      <section className="usage-confirmation-shell">
        <Link className="usage-confirmation-back" href="/projects/new/category"><ArrowLeft weight="bold" />返回选择类别</Link>
        <div className="usage-confirmation-heading">
          <p className="hero-kicker">使用前确认 · {category.label}类</p>
          <h1>开始填写前，请确认信息真实、准确。</h1>
          <p>隐私政策将直接依据您填写并确认的产品事实生成。准确的信息，是形成可用政策文本的前提。</p>
        </div>

        <div className="usage-confirmation-layout">
          <section className="usage-confirmation-explanation" aria-labelledby="usage-explanation-title">
            <span className="usage-confirmation-icon"><FileText weight="duotone" /></span>
            <h2 id="usage-explanation-title">为什么需要这一步</h2>
            <p>发布个人信息保护政策，是履行公开透明义务、保障个人信息主体知情权，以及接受监督的重要方式。政策应当清晰、准确、完整地描述公司的个人信息处理行为。</p>
            <div className="usage-confirmation-principles">
              <article><CheckCircle weight="fill" /><div><strong>信息真实、准确、完整</strong><span>填写内容应与产品实际功能、技术实现和运营方式一致。</span></div></article>
              <article><ShieldCheck weight="fill" /><div><strong>政策承诺能够落实</strong><span>涉及处理活动、安全措施和用户权利的承诺，应具备实际执行条件。</span></div></article>
              <article><Check weight="bold" /><div><strong>投入使用前完成复核</strong><span>生成结果应由公司法务或合规人员结合产品实际情况复核后使用。</span></div></article>
            </div>
          </section>

          <aside className="usage-confirmation-action" aria-labelledby="usage-confirmation-title">
            <span className="usage-confirmation-step">01</span>
            <h2 id="usage-confirmation-title">使用确认</h2>
            <p>本页不计入后续七个填写环节，每个新项目仅需确认一次。</p>
            <label className="usage-confirmation-check" data-checked={accepted}>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span aria-hidden="true"><Check weight="bold" /></span>
              <strong>我已阅读并确认：本公司提供的信息真实、准确、完整；政策中涉及本公司的处理活动、保障措施和相关承诺均能够实际落实。</strong>
            </label>
            <button
              type="button"
              className="usage-confirmation-submit"
              disabled={!accepted || creating}
              onClick={() => void confirmAndCreate()}
            >
              {creating ? "正在创建项目…" : "确认并开始填写"}<ArrowRight weight="bold" />
            </button>
            {error ? <p className="usage-confirmation-error" role="alert">{error}</p> : null}
            <small>确认后将创建项目，并进入第 1 环节“基本信息”。</small>
          </aside>
        </div>
      </section>
    </main>
  );
}
