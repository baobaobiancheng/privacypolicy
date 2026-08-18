import { notFound, redirect } from "next/navigation";
import { PrivacyWorkspace } from "@/components/privacy-workspace";
import { parseWorkspaceStep, workspaceSlugFor } from "@/src/workspace/contract";

// 早期别名：统一 302 到规范段，避免“同一状态两个 URL”。
const legacyAliases = new Map<string, string>([
  ["activities", "features"],
  ["exports", "draft"],
]);

export default async function ProjectSectionPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section: rawSection } = await params;
  const section = legacyAliases.get(rawSection) ?? rawSection;
  const step = parseWorkspaceStep(section);
  if (step === null) notFound();
  if (section !== rawSection) redirect(`/projects/${id}/${workspaceSlugFor(step)}`);
  return <PrivacyWorkspace projectId={id} initialStep={step} />;
}
