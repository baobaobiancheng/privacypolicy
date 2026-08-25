import { z } from "zod";
import { DomainError } from "@/src/domain/errors";
import { getDevPersona, isDevPersonaEnabled, type DevPersona } from "./dev-personas";

export const SessionActorSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum(["CLIENT_EDITOR", "PRODUCT_TECH", "ADMIN"]),
}).strict();

export type SessionActor = z.infer<typeof SessionActorSchema>;

/** 真实版本由 Auth.js session 提供；不接受表单或 URL 中的身份字段。 */
export function actorFromSession(session: unknown): SessionActor {
  const parsed = SessionActorSchema.safeParse(session);
  if (!parsed.success) {
    throw new DomainError("PROJECT_FORBIDDEN", "登录会话无效或已过期。", { retryable: false });
  }
  return parsed.data;
}

export function assertDevPersonaSwitchAllowed(environment = process.env.NODE_ENV): void {
  if (!isDevPersonaEnabled(environment)) {
    throw new DomainError("PROJECT_FORBIDDEN", "开发身份切换器仅在 development 环境可用。", { retryable: false });
  }
}

export function personaToSessionActor(persona: DevPersona): SessionActor {
  assertDevPersonaSwitchAllowed();
  return { userId: persona.userId, tenantId: persona.tenantId, role: persona.role };
}

const DEFAULT_PERSONA_ID = "client-editor";

/**
 * 开发环境路由身份：从 x-persona-id 请求头映射到 dev persona，缺省为「客户法务」。
 * 与现有 demo 路由一致，生产环境不可用（personaToSessionActor 内部会拦截）。
 */
export function requireDevActor(request: Request): SessionActor {
  const personaId = request.headers.get("x-persona-id") ?? DEFAULT_PERSONA_ID;
  const persona = getDevPersona(personaId);
  if (!persona) {
    throw new DomainError("PROJECT_FORBIDDEN", "未知的开发身份。", { retryable: false });
  }
  return personaToSessionActor(persona);
}
