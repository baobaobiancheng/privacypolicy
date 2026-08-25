import { notFound, redirect } from "next/navigation";
import { PrivacyWorkspace } from "@/components/privacy-workspace";
import { parseWorkspaceStep, workspaceSlugFor } from "@/src/workspace/contract";

// 早期别名：统一 302 到规范段，避免“同一状态两个 URL”。
const legacyAliases = new Map<string, string>([
  // 旧 scope 入口先进入流程末端，再由客户端完成度守卫回退到第一个未完成步骤。
  ["scope", "generate"],
  ["features", "processing"],
  ["review", "processing"],
  ["supplement", "permissions"],
  ["draft", "generate"],
  ["activities", "processing"],
  ["exports", "generate"],
]);

export default async function ProjectSectionPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section: rawSection } = await params;
  const section = legacyAliases.get(rawSection) ?? rawSection;
  const step = parseWorkspaceStep(section);
  if (step === null) notFound();
  if (section !== rawSection) redirect(`/projects/${id}/${workspaceSlugFor(step)}`);
  return <PrivacyWorkspace projectId={id} initialStep={step} />;
}
