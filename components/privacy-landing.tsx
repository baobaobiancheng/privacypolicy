"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Check, DownloadSimple, FileDoc, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import gsap from "gsap";
import Link from "next/link";
import { BaijianBrand } from "@/components/baijian-brand";

export function PrivacyLanding() {
  const pageRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(".landing-reveal", { y: 24, opacity: 0, duration: 0.72, stagger: 0.08, ease: "power2.out" });
    gsap.from(".landing-product-stage", { y: 34, opacity: 0, scale: 0.985, duration: 0.9, delay: 0.18, ease: "power3.out" });
  }, { scope: pageRef });

  return (
    <main ref={pageRef} className="landing-v3">
      <nav className="landing-v3-nav" aria-label="主导航">
        <BaijianBrand />
        <div className="landing-v3-links">
          <a href="#capabilities">产品能力</a>
          <a href="#workflow">工作原理</a>
          <a href="#boundary">安全与责任边界</a>
        </div>
        <div className="landing-v3-actions">
          <Link href="/projects">已有项目</Link>
          <Link className="v3-primary-button" data-analytics-id="landing.start" href="/projects/new/category">开始创建</Link>
        </div>
      </nav>

      <section className="landing-v3-hero" id="top">
        <div className="landing-v3-hero-copy">
          <h1 className="landing-reveal">把零散的产品事实，<br />整理成一份可用的隐私政策</h1>
          <p className="landing-reveal">通过结构化表单、智能补充与法规知识支持，帮助企业法务和产品团队更高效地形成隐私政策草稿。</p>
          <div className="landing-v3-hero-actions landing-reveal">
            <Link className="v3-primary-button v3-large-button" href="/projects/new/category">开始生成隐私政策 <ArrowRight weight="bold" /></Link>
            <a className="v3-secondary-button v3-large-button" href="#capabilities">查看生成示例</a>
          </div>
        </div>

        <div className="landing-product-stage" aria-label="隐私政策产品流程预览">
          <div className="landing-product-window">
            <div className="preview-progress-copy"><strong>第 4 / 7 步 · SDK 与合作方</strong><span>完成度 57%</span></div>
            <div className="preview-progress"><span /></div>
            <div className="preview-steps"><span><Check weight="bold" />基本信息</span><span><Check weight="bold" />功能与个人信息</span><span>3 设备权限</span><strong>4 SDK 与合作方</strong><span>5 存储与安全</span><span>6 用户权利</span><span>7 隐私政策生成</span></div>
            <div className="preview-form">
              <div><strong>后台定位</strong><small>触发场景</small><p>导航进行中、偏离路线、语音播报期间</p><small>停止条件</small><p>退出导航后立即停止</p></div>
              <div className="preview-ai"><span><Sparkle weight="fill" /> AI 助手</span><p>退出导航后，后台定位是否立即停止？</p><span className="preview-choice">立即停止</span><span className="preview-choice">继续用于轨迹记录</span></div>
            </div>
          </div>
          <div className="landing-document-card">
            <FileDoc weight="duotone" />
            <strong>行迹地图隐私政策</strong>
            <small>目录</small>
            <ol><li>我们如何收集和使用个人信息</li><li>我们如何使用 Cookie 和同类技术</li><li>我们如何共享、转让个人信息</li></ol>
          </div>
        </div>
      </section>

      <section id="capabilities" className="landing-capabilities">
        <div className="landing-section-heading"><h2>从产品事实到可下载文档</h2><p>系统负责组织问题和文档结构，客户始终掌握产品事实。</p></div>
        <div className="landing-capability-grid">
          <article><span className="capability-number">1</span><div><h3>结构化收集</h3><p>按场景收集产品、数据、目的、期限和第三方信息。</p></div><dl><div><dt>业务类型</dt><dd>地图与导航</dd></div><div><dt>数据类型</dt><dd>定位信息、设备信息</dd></div><div><dt>保存期限</dt><dd>90 天</dd></div></dl></article>
          <article><span className="capability-number capability-ai">2</span><div><h3>智能发现遗漏</h3><p>读取客户描述，针对仍不明确的产品事实继续追问。</p></div><div className="capability-ai-card"><span><Sparkle weight="fill" /> AI 助手</span><strong>退出导航后，定位是否立即停止？</strong><span className="preview-choice">立即停止</span></div></article>
          <article><span className="capability-number">3</span><div><h3>生成与下载</h3><p>生成结构完整的隐私政策草稿，并提供 Word 下载。</p></div><div className="capability-file"><FileDoc weight="duotone" /><div><strong>行迹地图隐私政策.docx</strong><small>2026-08-20 · 24.7 KB</small></div><DownloadSimple weight="bold" /></div></article>
        </div>
      </section>

      <section id="boundary" className="landing-trust-strip">
        <span><ShieldCheck weight="duotone" />客户事实由客户确认</span>
        <span><ShieldCheck weight="duotone" />参考资料不作为客户事实</span>
        <span><ShieldCheck weight="duotone" />支持 Word 下载</span>
      </section>

      <section id="workflow" className="landing-v3-cta">
        <div><span><Sparkle weight="duotone" /></span><div><h2>准备好开始了吗？</h2><p>创建项目后，按步骤填写产品信息，系统会帮助你形成一份可继续修改的隐私政策草稿。</p></div></div>
        <Link className="v3-primary-button v3-large-button" href="/projects/new/category">创建第一个项目 <ArrowRight weight="bold" /></Link>
      </section>

      <footer className="landing-v3-footer"><BaijianBrand compact /><p>隐私政策 · 企业隐私政策生成工具</p><a href="#top">返回顶部</a></footer>
    </main>
  );
}
