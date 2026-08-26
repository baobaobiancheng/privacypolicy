import { getSlotScenario } from "@/src/knowledge/map-cn";
import type { FormPayload } from "./form-payload";

export function sanitizeConfirmedForm(form: FormPayload): FormPayload {
  return {
    ...form,
    supplementAnswers: Object.fromEntries(Object.entries(form.supplementAnswers ?? {}).map(([questionId, answer]) => {
      const slotScenario = getSlotScenario(questionId);
      const confirmedSlots = Object.fromEntries(Object.entries(answer.slots ?? {}).filter(([, slot]) => slot.status === "CONFIRMED"));
      return [questionId, {
        ...answer,
        detail: slotScenario ? "" : answer.detail,
        slots: confirmedSlots,
      }];
    })),
  };
}

export function hasConfirmedSupplementSlots(form: FormPayload, questionId: string): boolean {
  const answer = form.supplementAnswers?.[questionId];
  return answer?.answer === "YES" && Object.values(answer.slots ?? {}).some((slot) => slot.status === "CONFIRMED" && slot.value.trim());
}
