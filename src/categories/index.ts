import { z } from "zod";
import rawRegistry from "./app-categories-v1.0.0.json";

const CategorySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  basicFunction: z.string().min(1),
  necessaryInfoSummary: z.string().min(1),
  availability: z.enum(["OPEN", "COMING_SOON"]),
  formVersion: z.string().nullable(),
});

const RegistrySchema = z.object({
  schemaVersion: z.literal("1"),
  categoryVersion: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  groups: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    categories: z.array(CategorySchema),
  })),
});

export const appCategoryRegistry = RegistrySchema.parse(rawRegistry);
export type AppCategory = z.infer<typeof CategorySchema>;
export const appCategories = appCategoryRegistry.groups.flatMap((group) => group.categories);

if (appCategories.length !== 39 || new Set(appCategories.map((item) => item.key)).size !== 39) {
  throw new Error("应用类别配置必须包含 39 个唯一类别。");
}

export function getAppCategory(key: string) {
  return appCategories.find((item) => item.key === key);
}

export const OPEN_CATEGORY_KEY = "map-navigation";
