import { describe, expect, it } from "vitest";
import { buildPolicyGenerationContext } from "@/src/application/generation/policy-generation-context";
import { createDevelopmentProjectFormData } from "@/src/workspace/development-defaults";
import { toGenerationForm } from "@/src/workspace/form-adapter";

describe("PolicyGenerationContext", () => {
  it("keeps canonical facts without transmitting legacy duplicates", () => {
    const form = createDevelopmentProjectFormData();
    const legacy = toGenerationForm(form);
    const context = buildPolicyGenerationContext(form);

    expect(legacy).not.toHaveProperty("projectFacts");
    expect(context.activities).toEqual(form.processingActivities);
    expect(context.permissions).toEqual(form.permissions);
    expect(context.partners).toEqual(form.partners);
    expect(context.storageAndSecurity).toEqual(form.storageAndSecurity);
    expect(context.rightsAndGovernance).toEqual(form.rightsAndGovernance);
  });

  it("only includes confirmed attachment contents and supplement slots", () => {
    const form = createDevelopmentProjectFormData();
    form.attachments = [
      { id: "pending", name: "pending.txt", kind: "TEXT", status: "PENDING", mimeType: "text/plain", size: 1, content: "pending", truncated: false },
      { id: "confirmed", name: "confirmed.txt", kind: "TEXT", status: "CONFIRMED", mimeType: "text/plain", size: 1, content: "confirmed", truncated: false },
    ];
    form.supplementAnswers["third-party-services"] = {
      answer: "YES",
      detail: "raw text",
      slots: {
        name: { value: "confirmed SDK", status: "CONFIRMED" },
        candidate: { value: "candidate SDK", status: "CANDIDATE" },
      },
    };
    form.supplementAnswers["unconfirmed-topic"] = {
      answer: "UNKNOWN",
      detail: "尚未确认，不应发送给模型",
      slots: {},
    };

    const context = buildPolicyGenerationContext(form);
    expect(context.confirmedAttachments).toEqual([{ name: "confirmed.txt", kind: "TEXT", content: "confirmed", truncated: false }]);
    expect(context.confirmedSupplements["third-party-services"]?.detail).toBe("");
    expect(Object.keys(context.confirmedSupplements["third-party-services"]?.slots ?? {})).toEqual(["name"]);
    expect(context.confirmedSupplements).not.toHaveProperty("unconfirmed-topic");
  });

  it("reduces the model fact payload by at least thirty percent", () => {
    const form = createDevelopmentProjectFormData();
    const oldPayload = JSON.stringify({ ...toGenerationForm(form), projectFacts: form });
    const compactPayload = JSON.stringify(buildPolicyGenerationContext(form));
    expect(compactPayload.length).toBeLessThanOrEqual(oldPayload.length * 0.7);
  });
});
