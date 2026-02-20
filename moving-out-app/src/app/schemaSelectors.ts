import type { AssignmentField, AssignmentSchema } from "../schema";

export function getSectionFields(schema: AssignmentSchema, sectionId: string): AssignmentField[] {
  return schema.fields.filter((field) => field.section_id === sectionId);
}

export function isReflectionRole(field: AssignmentField): boolean {
  return field.role === "reflection";
}
