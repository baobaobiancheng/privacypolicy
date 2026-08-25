import { PrismaClient } from "@prisma/client";
import { DEV_PERSONAS } from "@/src/auth/dev-personas";
import { getPrisma } from "./prisma";

let defaultClientSeed: Promise<void> | null = null;

/** 确保开发身份在 users 表存在，满足 Project.ownerId 外键。幂等。 */
export async function ensureDevUsers(prisma?: PrismaClient): Promise<void> {
  const client = prisma ?? getPrisma();
  const seed = () => client.user.createMany({
    data: DEV_PERSONAS.map((persona) => ({
      id: persona.userId,
      tenantId: persona.tenantId,
      displayName: persona.label,
      role: persona.role,
    })),
    skipDuplicates: true,
  }).then(() => undefined);

  if (prisma) {
    await seed();
    return;
  }

  defaultClientSeed ??= seed().catch((error) => {
    defaultClientSeed = null;
    throw error;
  });
  await defaultClientSeed;
}
