export function normalizeJsonModelOutput(content: string | Array<{ text?: string }> | null | undefined): string {
  const text = typeof content === "string"
    ? content
    : Array.isArray(content) ? content.map((part) => part.text || "").join("") : "";
  return text.replace(/^\s*```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trim();
}
