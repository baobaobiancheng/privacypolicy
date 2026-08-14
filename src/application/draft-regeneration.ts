export function createGenerationId(projectId: string, now = Date.now()) {
  return `${projectId}-g${now.toString(36)}`;
}

export function canReuseSuccessfulFactReview(currentInputHash: string, successfulInputHashes: string[]) {
  return successfulInputHashes.includes(currentInputHash);
}

export function haveEquivalentDraftInput(current: unknown, candidates: unknown[]) {
  const normalizedCurrent = canonicalJson(current);
  return candidates.some((candidate) => canonicalJson(candidate) === normalizedCurrent);
}

export function fallbackMapLawKeywords(options: { hasLocation: boolean; hasThirdParty: boolean }) {
  return [
    "个人信息保护法",
    "必要个人信息 地图导航",
    ...(options.hasLocation ? ["敏感个人信息 位置信息"] : []),
    ...(options.hasThirdParty ? ["个人信息 委托处理 共享"] : []),
  ].slice(0, 5);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
