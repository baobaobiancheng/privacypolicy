"use client";

import { BracketsCurly, Check } from "@phosphor-icons/react";
import { getSlotScenario } from "@/src/knowledge/map-cn";
import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import { QUESTION_DETAIL_PRESETS, SLOT_PRESETS, type ProjectData } from "./workspace-model";

type SupplementQuestionDefinition = {
  id: string;
  title: string;
  help: string;
};

type SupplementQuestionProps = {
  question: SupplementQuestionDefinition;
  data: ProjectData;
  extractingQuestionId: string | null;
  updateSupplement: (questionId: string, patch: Partial<SupplementAnswer>) => void;
  toggleQuestionDetailPreset: (questionId: string, value: string) => void;
  updateQuestionDetailOther: (questionId: string, value: string, presets: readonly string[]) => void;
  updateSupplementSlot: (questionId: string, slotId: string, value: string, status?: "CANDIDATE" | "CONFIRMED", evidenceText?: string) => void;
  toggleSupplementSlotPreset: (questionId: string, slotId: string, value: string) => void;
  updateSupplementSlotOther: (questionId: string, slotId: string, value: string, presets: readonly string[]) => void;
  extractSupplementSlots: (questionId: string) => Promise<void>;
};

export function SupplementQuestion(props: SupplementQuestionProps) {
  const { question, data } = props;
  const answer = data.supplementAnswers[question.id];
  const slotScenario = getSlotScenario(question.id);
  const detailPresets = QUESTION_DETAIL_PRESETS[question.id] ?? [];
  const detailValues = (answer?.detail ?? "").split("；").map((item) => item.trim()).filter(Boolean);
  const detailOther = detailValues.filter((value) => !detailPresets.includes(value)).join("；");

  return <article className="supplement-question compact-question" data-answer={answer?.answer ?? "EMPTY"}>
    <div><strong>{question.title}</strong><p>请选择产品实际存在的情况；未选择的内容不会写入政策。</p><small>{question.help}</small></div>
    {slotScenario ? <div className="slot-workspace">
      <div className="slot-workspace-heading"><div><strong>{slotScenario.title}</strong></div></div>
      <div className="slot-fields">{slotScenario.slots.map((slotItem) => {
        const slotAnswer = answer?.slots?.[slotItem.id];
        const presets = SLOT_PRESETS[slotScenario.scenarioId]?.[slotItem.id] ?? [];
        const values = (slotAnswer?.value ?? "").split("；").map((item) => item.trim()).filter(Boolean);
        const otherValue = values.filter((value) => !presets.includes(value)).join("；");
        return <section className="slot-field" data-status={slotAnswer?.status ?? "EMPTY"} key={slotItem.id}>
          <span><strong>{slotItem.label}{slotItem.required ? " *" : ""}</strong>{slotAnswer?.status === "CANDIDATE" ? <em>待核对</em> : slotAnswer?.status === "CONFIRMED" ? <em>已填写</em> : null}</span>
          {presets.length ? <div className="preset-chips">{presets.map((preset) => <button type="button" key={preset} data-selected={values.includes(preset)} onClick={() => props.toggleSupplementSlotPreset(question.id, slotItem.id, preset)}>{values.includes(preset) ? <Check weight="bold" /> : null}{preset}</button>)}</div> : null}
          <label><span>{presets.length ? "其他（可选）" : slotItem.prompt}</span>{slotItem.inputType === "textarea" ? <textarea value={presets.length ? otherValue : slotAnswer?.value ?? ""} onChange={(event) => presets.length ? props.updateSupplementSlotOther(question.id, slotItem.id, event.target.value, presets) : props.updateSupplementSlot(question.id, slotItem.id, event.target.value)} placeholder={presets.length ? "如有其他情况，请补充说明。" : slotItem.prompt} /> : <input type={slotItem.inputType === "url" ? "url" : "text"} value={slotAnswer?.value ?? ""} onChange={(event) => props.updateSupplementSlot(question.id, slotItem.id, event.target.value)} placeholder={slotItem.prompt} />}</label>
          {slotAnswer?.status === "CANDIDATE" ? <button type="button" onClick={() => props.updateSupplementSlot(question.id, slotItem.id, slotAnswer.value, "CONFIRMED", slotAnswer.evidenceText)}><Check weight="bold" /> 采用此内容</button> : null}
        </section>;
      })}</div>
      <label className="supplement-detail"><span>其他整体说明（可选）</span><textarea value={answer?.detail ?? ""} onChange={(event) => props.updateSupplement(question.id, { answer: event.target.value.trim() || Object.keys(answer?.slots ?? {}).length ? "YES" : "NO", detail: event.target.value })} placeholder="如有其他情况，请补充说明。" /></label>
      <button type="button" className="slot-extract-button" disabled={props.extractingQuestionId === question.id || !answer?.detail.trim()} onClick={() => void props.extractSupplementSlots(question.id)}><BracketsCurly weight="bold" /> {props.extractingQuestionId === question.id ? "正在整理…" : "从说明中智能整理"}</button>
    </div> : <div className="supplement-choice-detail">
      <div className="preset-chips">{detailPresets.map((preset) => <button type="button" key={preset} data-selected={detailValues.includes(preset)} onClick={() => props.toggleQuestionDetailPreset(question.id, preset)}>{detailValues.includes(preset) ? <Check weight="bold" /> : null}{preset}</button>)}</div>
      <label className="supplement-detail"><span>其他（可选）</span><textarea value={detailOther} onChange={(event) => props.updateQuestionDetailOther(question.id, event.target.value, detailPresets)} placeholder="如有其他情况，请补充说明。" /></label>
    </div>}
  </article>;
}
