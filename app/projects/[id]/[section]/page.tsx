import { notFound } from "next/navigation";
import { PrivacyWorkspace } from "@/components/privacy-workspace";

const sections = new Map<string, 0 | 1 | 2 | 3 | 4>([
  ["scope", 0],
  ["profile", 1],
  ["features", 2],
  ["activities", 2],
  ["tasks", 3],
  ["review", 3],
  ["draft", 4],
  ["exports", 4],
]);

export default async function ProjectSectionPage({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  const step = sections.get(section);
  if (step === undefined) notFound();
  return <PrivacyWorkspace projectId={id} initialStep={step} />;
}
