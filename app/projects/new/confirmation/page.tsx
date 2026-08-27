import { redirect } from "next/navigation";
import { ProjectUsageConfirmation } from "@/components/project-usage-confirmation";
import { getAppCategory } from "@/src/categories";

export default async function NewProjectConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryKey } = await searchParams;
  const category = categoryKey ? getAppCategory(categoryKey) : null;
  if (!category || category.availability !== "OPEN") redirect("/projects/new/category");
  return <ProjectUsageConfirmation category={category} />;
}
