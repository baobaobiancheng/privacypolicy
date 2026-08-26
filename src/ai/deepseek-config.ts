export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

export function configuredDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}
