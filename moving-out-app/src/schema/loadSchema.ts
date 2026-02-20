import assignmentSchemaRaw from "../../schema/assignment.schema.json";
import constantsRaw from "../../schema/constants.json";
import type { AssignmentSchema, Constants } from "./types";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getAssignmentSchema(): AssignmentSchema {
  return deepClone(assignmentSchemaRaw as AssignmentSchema);
}

export function getDefaultConstants(): Constants {
  return deepClone(constantsRaw as Constants);
}
