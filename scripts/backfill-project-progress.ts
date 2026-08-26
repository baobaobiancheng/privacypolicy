import { getPrisma } from "../src/data/prisma";
import { calculateProjectProgress, ProjectFormDataSchema } from "../src/workspace/contract";

const BATCH_SIZE = 200;

async function main() {
  const prisma = getPrisma();
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const rows = await prisma.project.findMany({
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, formData: true, progressPercent: true },
    });
    if (!rows.length) break;
    await prisma.$transaction(rows.flatMap((row) => {
      const parsed = ProjectFormDataSchema.safeParse(row.formData);
      if (!parsed.success) return [];
      const progressPercent = calculateProjectProgress(parsed.data);
      if (progressPercent === row.progressPercent) return [];
      updated += 1;
      return [prisma.project.update({ where: { id: row.id }, data: { progressPercent }, select: { id: true } })];
    }));
    cursor = rows.at(-1)?.id;
  }
  console.info(JSON.stringify({ level: "info", event: "project_progress_backfill_completed", updated }));
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", event: "project_progress_backfill_failed", error: String(error) }));
  process.exitCode = 1;
});
