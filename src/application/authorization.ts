import { DomainError } from "@/src/domain/errors";

export type ActorRole = "CLIENT_EDITOR" | "PRODUCT_TECH" | "LAWYER_REVIEWER" | "ADMIN";
export type ProjectAction = "READ" | "EDIT" | "REVIEW" | "EXPORT";

export type Actor = {
  userId: string;
  tenantId: string;
  role: ActorRole;
};

export type ProjectAccessRecord = {
  tenantId: string;
  ownerId: string;
  access: ReadonlyArray<{ userId: string; role: ActorRole }>;
};

export function authorizeProject(actor: Actor, project: ProjectAccessRecord | null, action: ProjectAction): void {
  if (!project || project.tenantId !== actor.tenantId) {
    throw new DomainError("PROJECT_FORBIDDEN", "你无权访问该项目。", { retryable: true });
  }

  const access = project.access.find((item) => item.userId === actor.userId);
  const isOwner = project.ownerId === actor.userId;
  const canRead = isOwner || Boolean(access);
  const canEdit = isOwner || access?.role === "CLIENT_EDITOR" || access?.role === "PRODUCT_TECH" || actor.role === "ADMIN";
  const canReview = access?.role === "LAWYER_REVIEWER" || actor.role === "LAWYER_REVIEWER" || actor.role === "ADMIN";

  const allowed = action === "READ" ? canRead : action === "EDIT" ? canEdit : action === "REVIEW" ? canReview : canReview || canEdit;
  if (!allowed) {
    throw new DomainError("PROJECT_FORBIDDEN", "当前身份没有执行该项目操作的权限。", { retryable: true });
  }
}
