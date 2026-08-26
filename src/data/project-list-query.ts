import { Prisma } from "@prisma/client";

export const projectListSelect = {
  id: true,
  name: true,
  productName: true,
  status: true,
  revision: true,
  updatedAt: true,
  progressPercent: true,
  categoryKey: true,
  categoryVersion: true,
  currentStepKey: true,
  reports: {
    where: { state: "CURRENT" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, createdAt: true },
  },
} satisfies Prisma.ProjectSelect;
