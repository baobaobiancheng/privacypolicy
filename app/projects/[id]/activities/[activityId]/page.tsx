import { PrivacyWorkspace } from "@/components/privacy-workspace";

export default async function ActivityPage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id } = await params;
  return <PrivacyWorkspace projectId={id} initialStep={2} />;
}
