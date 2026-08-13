export const DEV_PERSONAS = [
  { id: "client-editor", label: "客户法务", role: "CLIENT_EDITOR", tenantId: "demo-tenant", userId: "demo-client" },
  { id: "product-tech", label: "产品与技术", role: "PRODUCT_TECH", tenantId: "demo-tenant", userId: "demo-product" },
  { id: "lawyer-reviewer", label: "复核律师", role: "LAWYER_REVIEWER", tenantId: "demo-tenant", userId: "demo-lawyer" },
] as const;

export type DevPersona = (typeof DEV_PERSONAS)[number];

export function getDevPersona(id: string): DevPersona | null {
  return DEV_PERSONAS.find((persona) => persona.id === id) ?? null;
}

export function isDevPersonaEnabled(environment = process.env.NODE_ENV): boolean {
  if (environment === "development") return true;
  // 生产环境在接真实登录前，如需保留开发身份机制，用 ALLOW_DEV_PERSONA=1 显式放行。
  const flag = process.env.ALLOW_DEV_PERSONA;
  return flag === "1" || flag === "true";
}
