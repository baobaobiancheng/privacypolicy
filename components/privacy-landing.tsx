"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  ClipboardText,
  Database,
  Gavel,
  ShieldCheck,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { reviewNotes, scenarios } from "@/src/content/map-v1/ui-content";

gsap.registerPlugin(ScrollTrigger);

export function PrivacyLanding() {
  const pageRef = useRef<HTMLElement>(null);
  const [activeScenario, setActiveScenario] = useState(scenarios[0]?.id ?? "");
  const [reviewIndex, setReviewIndex] = useState(0);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-reveal", {
          y: 44,
          opacity: 0,
          duration: 1.05,
          stagger: 0.11,
          ease: "power3.out",
        });

        ScrollTrigger.matchMedia({
          "(min-width: 1024px)": () => {
            ScrollTrigger.create({
              trigger: ".flow-shell",
              start: "top 112px",
              end: "bottom bottom",
              pin: ".flow-copy",
              pinSpacing: false,
            });
          },
        });

        gsap.utils.toArray<HTMLElement>(".stack-card").forEach((card, index) => {
          gsap.fromTo(
            card,
            { y: 72 + index * 12, scale: 0.92, opacity: 0.32 },
            {
              y: 0,
              scale: 1,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                end: "top 46%",
                scrub: 0.8,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".word-reveal span").forEach((word) => {
          gsap.fromTo(
            word,
            { opacity: 0.12 },
            {
              opacity: 1,
              scrollTrigger: {
                trigger: word,
                start: "top 88%",
                end: "top 62%",
                scrub: true,
              },
            },
          );
        });
      });

      return () => media.revert();
    },
    { scope: pageRef },
  );

  return (
    <main ref={pageRef} className="landing-page w-full max-w-full overflow-x-hidden bg-paper text-ink">
      <nav className="site-nav" aria-label="主导航">
        <a href="#top" className="brand" aria-label="知证首页">
          <span className="brand-mark"><ShieldCheck weight="fill" /></span>
          <span>知证</span>
        </a>
        <div className="nav-center" aria-label="页面章节">
          <a href="#evidence">证据边界</a>
          <a href="#workflow">填写流程</a>
          <a href="#review">律师复核</a>
        </div>
        <Link className="nav-cta" href="/projects/new/scope">开始填写 <ArrowRight weight="bold" /></Link>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-ambient" aria-hidden="true" />
        <div className="hero-grid landing-hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker hero-reveal">证据驱动的隐私政策协作生成器</p>
            <h1 className="hero-reveal max-w-5xl">先确认产品事实，再生成经得起复核的隐私政策草稿</h1>
            <p className="hero-lede hero-reveal">
              把法规要求、行业示例和客户真实情况分开。客户法务完成事实收集，产品与技术补充未知项，律师只处理真正需要法律判断的部分。
            </p>
            <div className="hero-actions hero-reveal">
              <Link className="button button-primary" href="/projects/new/scope">开始填写 <ArrowRight weight="bold" /></Link>
              <a className="button button-secondary" href="#evidence">查看证据边界</a>
            </div>
            <p className="landing-note hero-reveal">地图导航类首期试点 · 客户填写，律师复核 · 生成工作草稿</p>
          </div>
        </div>
      </section>

      <section id="evidence" className="evidence-section">
        <div className="section-intro">
          <p>同一段文字，先问它凭什么成立</p>
          <h2>五层证据边界，让系统提醒遗漏，却不替客户编造事实。</h2>
        </div>

        <div className="evidence-bento grid grid-cols-12 grid-rows-2 grid-flow-dense">
          <article className="evidence-card evidence-main col-span-7 row-span-2 group">
            <div className="evidence-image-wrap overflow-hidden">
              <div className="evidence-image group-hover:scale-105" role="img" aria-label="城市地图纹理" />
            </div>
            <div className="evidence-card-content">
              <span className="evidence-icon"><Gavel weight="duotone" /></span>
              <div><p>法规规则是边界，不是产品事实</p><h3>地图类法定必要信息只有位置信息、出发地和到达地。</h3></div>
            </div>
          </article>
          <article className="evidence-card evidence-client col-span-5 row-span-1 group">
            <span className="evidence-icon"><Database weight="duotone" /></span>
            <div><p>客户事实</p><h3>只有逐字段确认的真实处理活动，才能进入工作草稿正文。</h3></div>
          </article>
          <article className="evidence-card evidence-review col-span-5 row-span-1 group">
            <span className="evidence-icon"><ClipboardText weight="duotone" /></span>
            <div><p>律师判断</p><h3>必要性与处理依据单独复核，不覆盖事实来源。</h3></div>
          </article>
        </div>
      </section>

      <section id="workflow" className="workflow-section">
        <div className="flow-shell">
          <div className="flow-copy">
            <p>从法规锚点到客户事实</p>
            <h2>五组场景，一项一项确认。</h2>
            <p className="flow-description">先浏览适用的地图类场景，进入试点后再在独立工作区填写。展示页的说明不会预先创建项目，也不会保存选择。</p>
            <Link className="text-link" href="/projects/new/scope">进入地图类试点 <ArrowRight weight="bold" /></Link>
          </div>

          <div className="scenario-accordion" aria-label="地图类五组场景说明">
            {scenarios.map((scenario, index) => {
              const isActive = activeScenario === scenario.id;
              return (
                <article key={scenario.id} className="scenario-panel group" data-active={isActive}>
                  <button type="button" className="scenario-trigger" aria-expanded={isActive} onClick={() => setActiveScenario(scenario.id)}>
                    <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="scenario-vertical-title">{scenario.title}</span>
                  </button>
                  <div className="scenario-detail" aria-hidden={!isActive}>
                    <div><p className="scenario-group">{scenario.group}</p><h3>{scenario.title}</h3><p>{scenario.summary}</p></div>
                    <div className="field-chips">{scenario.fields.map((field) => <span key={field}>{field}</span>)}</div>
                    {scenario.risk && <p className="scenario-risk">{scenario.risk}</p>}
                    <div className="scenario-footer"><span className="scenario-readonly"><CaretRight weight="bold" /> 进入工作区后填写</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="review" className="review-section">
        <div className="review-copy">
          <p>协作不是把同一张表发给所有人</p>
          <h2 className="word-reveal">{"客户确认事实 律师判断依据 系统保留证据 每个人只回答自己真正知道的问题".split(" ").map((word) => <span key={word}>{word} </span>)}</h2>
        </div>
        <div className="review-carousel">
          <div className="review-portraits" aria-hidden="true">{["lawyer-one", "product-two", "engineer-three"].map((seed, index) => <div key={seed} className="portrait" data-active={index === reviewIndex} style={{ backgroundImage: `url(https://picsum.photos/seed/${seed}/320/420)` }} />)}</div>
          <blockquote><span>“</span>{reviewNotes[reviewIndex].quote}</blockquote>
          <div className="review-controls"><div><strong>{reviewNotes[reviewIndex].role}</strong><span>{reviewIndex + 1} / {reviewNotes.length}</span></div><div><button type="button" aria-label="上一条" onClick={() => setReviewIndex((index) => (index - 1 + reviewNotes.length) % reviewNotes.length)}><ArrowLeft weight="bold" /></button><button type="button" aria-label="下一条" onClick={() => setReviewIndex((index) => (index + 1) % reviewNotes.length)}><ArrowRight weight="bold" /></button></div></div>
        </div>
      </section>

      <section className="action-section">
        <div className="stack-cards" aria-hidden="true">
          <div className="stack-card stack-one"><span>客户事实</span><strong>逐字段确认</strong></div>
          <div className="stack-card stack-two"><span>确定性规则</span><strong>阻断与风险</strong></div>
          <div className="stack-card stack-three"><span>不可变快照</span><strong>可追溯草稿</strong></div>
        </div>
        <div className="action-copy"><h2>先完成一次真实填写，再决定要不要让 AI 参与。</h2><p>地图类首期先验证事实收集、证据边界和律师复核是否真正减少沟通轮次。</p><Link className="button button-light" href="/projects/new/scope">进入地图类试点 <ArrowRight weight="bold" /></Link></div>
      </section>

      <footer className="site-footer"><a href="#top" className="brand"><span className="brand-mark"><ShieldCheck weight="fill" /></span><span>知证</span></a><p>隐私政策工作草稿生成器 · 客户填写，律师复核</p><div><a href="#evidence">证据边界</a><a href="#workflow">填写流程</a><a href="#top">返回顶部</a></div></footer>
    </main>
  );
}
