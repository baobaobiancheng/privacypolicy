import { PrismaClient } from "@prisma/client";
import { DEV_PERSONAS } from "@/src/auth/dev-personas";
import { getPrisma } from "./prisma";

/** 确保开发身份在 users 表存在，满足 Project.ownerId 外键。幂等。 */
export async function ensureDevUsers(prisma: PrismaClient = getPrisma()): Promise<void> {
  await prisma.user.createMany({
    data: DEV_PERSONAS.map((persona) => ({
      id: persona.userId,
      tenantId: persona.tenantId,
      displayName: persona.label,
      role: persona.role,
    })),
    skipDuplicates: true,
  });
}
