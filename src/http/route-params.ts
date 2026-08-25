import type { EntityIdPrefix } from "@/src/domain/ids";
import { isEntityId } from "@/src/domain/ids";
import { invalidInput } from "./api-error";

export function requireEntityId(value: string, prefix: EntityIdPrefix, label: string): string {
  if (!isEntityId(value, prefix)) throw invalidInput(`${label}格式无效。`, { field: label });
  return value;
}
