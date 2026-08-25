export const DEV_PERSONAS = [
  { id: "client-editor", label: "客户法务", role: "CLIENT_EDITOR", tenantId: "demo-tenant", userId: "demo-client" },
  { id: "product-tech", label: "产品与技术", role: "PRODUCT_TECH", tenantId: "demo-tenant", userId: "demo-product" },
] as const;

export type DevPersona = (typeof DEV_PERSONAS)[number];

export function getDevPersona(id: string): DevPersona | null {
  return DEV_PERSONAS.find((persona) => persona.id === id) ?? null;
}

export function isDevPersonaEnabled(environment = process.env.NODE_ENV): boolean {
  return environment === "development" || environment === "test";
}
