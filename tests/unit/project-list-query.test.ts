import { describe, expect, it } from "vitest";
import { projectListSelect } from "@/src/data/project-list-query";

describe("project list query", () => {
  it("reads summary columns without loading questionnaire JSON", () => {
    expect(projectListSelect).not.toHaveProperty("formData");
    expect(projectListSelect.progressPercent).toBe(true);
    expect(projectListSelect.reports.select).toEqual({ id: true, createdAt: true });
  });
});
