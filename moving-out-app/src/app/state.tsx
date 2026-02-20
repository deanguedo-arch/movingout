import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { removeEvidenceByType, upsertEvidenceForType } from "../evidence/evidenceService";
import { appendEvent } from "../logs/eventLog";
import { computeBudget, computeReadinessFlags } from "../rules";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import type {
  AssignmentField,
  AssignmentSchema,
  Constants,
  EvidenceFile,
  EvidenceItem,
  EvidenceType,
  InputValue,
  ReadinessFlags,
  Submission,
} from "../schema";
import {
  getConstantsOverrides,
  getSubmission,
  listEvidenceFiles,
  listEvidenceItems,
  saveSubmission,
} from "../storage/repositories";

type AppStateContextValue = {
  loading: boolean;
  schema: AssignmentSchema;
  constants: Constants;
  submission: Submission;
  evidence: EvidenceItem[];
  evidenceFiles: EvidenceFile[];
  setInputValue: (fieldId: string, value: InputValue) => Promise<void>;
  setReflectionValue: (fieldId: string, value: string) => Promise<void>;
  saveEvidence: (args: { type: EvidenceType; url?: string; files?: File[] }) => Promise<void>;
  removeEvidence: (type: EvidenceType) => Promise<void>;
  recomputeNow: () => Promise<void>;
  reloadFromStorage: () => Promise<void>;
};

const schema = getAssignmentSchema();
const defaultConstants = getDefaultConstants();

const EMPTY_FLAGS: ReadinessFlags = {
  missing_required_fields: [],
  missing_required_evidence: [],
  affordability_fail: false,
  deficit: false,
  fragile_buffer: false,
  surplus_or_deficit_amount: 0,
  fix_next: [],
};

function buildInitialSubmission(args: { schema: AssignmentSchema; constants: Constants; evidence: EvidenceItem[] }): Submission {
  const { schema: schemaDef, constants, evidence } = args;
  const inputs: Submission["inputs"] = {};
  const reflections: Submission["reflections"] = {};

  schemaDef.fields.forEach((field) => {
    if (field.role === "reflection") {
      reflections[field.id] = "";
      return;
    }
    if (field.role === "input") {
      inputs[field.id] = field.type === "checkbox" ? false : null;
    }
  });

  const derived = computeBudget({ inputs, constants });
  const base: Submission = {
    id: crypto.randomUUID(),
    schema_version: schemaDef.schema_version,
    constants_version: constants.constants_version,
    student: {},
    inputs,
    reflections,
    derived,
    flags: EMPTY_FLAGS,
    pinned: [],
    evidence_refs: {},
    updated_at: new Date().toISOString(),
  };
  return {
    ...base,
    flags: computeReadinessFlags({
      schema: schemaDef,
      submission: base,
      evidence,
      constants,
    }),
  };
}

function recomputeSubmission(args: {
  submission: Submission;
  schema: AssignmentSchema;
  constants: Constants;
  evidence: EvidenceItem[];
}): Submission {
  const { submission, schema: schemaDef, constants, evidence } = args;
  const derived = computeBudget({
    inputs: submission.inputs,
    constants,
  });
  const nextSubmission: Submission = {
    ...submission,
    schema_version: schemaDef.schema_version,
    constants_version: constants.constants_version,
    derived,
    updated_at: new Date().toISOString(),
  };
  return {
    ...nextSubmission,
    flags: computeReadinessFlags({
      schema: schemaDef,
      submission: nextSubmission,
      evidence,
      constants,
    }),
  };
}

function isReflectionField(field: AssignmentField): boolean {
  return field.role === "reflection";
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState<Constants>(defaultConstants);
  const [submission, setSubmission] = useState<Submission>(
    buildInitialSubmission({
      schema,
      constants: defaultConstants,
      evidence: [],
    }),
  );
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);

  const reloadFromStorage = useCallback(async () => {
    setLoading(true);
    const [constantsOverrides, savedSubmission, evidenceItems, files] = await Promise.all([
      getConstantsOverrides(),
      getSubmission(),
      listEvidenceItems(),
      listEvidenceFiles(),
    ]);

    const activeConstants = constantsOverrides ?? defaultConstants;
    const baseSubmission =
      savedSubmission ??
      buildInitialSubmission({
        schema,
        constants: activeConstants,
        evidence: evidenceItems,
      });
    const hydrated = recomputeSubmission({
      submission: baseSubmission,
      schema,
      constants: activeConstants,
      evidence: evidenceItems,
    });

    setConstants(activeConstants);
    setEvidence(evidenceItems);
    setEvidenceFiles(files);
    setSubmission(hydrated);
    await saveSubmission(hydrated);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reloadFromStorage();
  }, [reloadFromStorage]);

  const persistSubmission = useCallback(
    async (nextSubmission: Submission) => {
      setSubmission(nextSubmission);
      await saveSubmission(nextSubmission);
    },
    [],
  );

  const recomputeNow = useCallback(async () => {
    const next = recomputeSubmission({
      submission,
      schema,
      constants,
      evidence,
    });
    await appendEvent("COMPUTE_RUN", { source: "manual" });
    await persistSubmission(next);
  }, [constants, evidence, persistSubmission, submission]);

  const setInputValue = useCallback(
    async (fieldId: string, value: InputValue) => {
      const prevValue = submission.inputs[fieldId] ?? null;
      const updated: Submission = {
        ...submission,
        inputs: {
          ...submission.inputs,
          [fieldId]: value,
        },
      };
      const next = recomputeSubmission({
        submission: updated,
        schema,
        constants,
        evidence,
      });
      await appendEvent("FIELD_EDIT", {
        field_id: fieldId,
        old: prevValue,
        next: value,
      });
      await appendEvent("COMPUTE_RUN", {
        source: "field_edit",
        field_id: fieldId,
      });
      await persistSubmission(next);
    },
    [constants, evidence, persistSubmission, submission],
  );

  const setReflectionValue = useCallback(
    async (fieldId: string, value: string) => {
      const prevValue = submission.reflections[fieldId] ?? "";
      const updated: Submission = {
        ...submission,
        reflections: {
          ...submission.reflections,
          [fieldId]: value,
        },
      };
      const next = recomputeSubmission({
        submission: updated,
        schema,
        constants,
        evidence,
      });
      await appendEvent("FIELD_EDIT", {
        field_id: fieldId,
        old: prevValue,
        next: value,
      });
      await appendEvent("COMPUTE_RUN", {
        source: "field_edit",
        field_id: fieldId,
      });
      await persistSubmission(next);
    },
    [constants, evidence, persistSubmission, submission],
  );

  const saveEvidence = useCallback(
    async (args: { type: EvidenceType; url?: string; files?: File[] }) => {
      const result = await upsertEvidenceForType({
        type: args.type,
        url: args.url,
        files: args.files ?? [],
        submission,
      });
      const files = await listEvidenceFiles();
      const nextSubmission = recomputeSubmission({
        submission: result.submission,
        schema,
        constants,
        evidence: result.evidenceItems,
      });
      setEvidence(result.evidenceItems);
      setEvidenceFiles(files);
      await persistSubmission(nextSubmission);
    },
    [constants, persistSubmission, submission],
  );

  const removeEvidence = useCallback(
    async (type: EvidenceType) => {
      const result = await removeEvidenceByType({
        type,
        submission,
      });
      const files = await listEvidenceFiles();
      const nextSubmission = recomputeSubmission({
        submission: result.submission,
        schema,
        constants,
        evidence: result.evidenceItems,
      });
      setEvidence(result.evidenceItems);
      setEvidenceFiles(files);
      await persistSubmission(nextSubmission);
    },
    [constants, persistSubmission, submission],
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      loading,
      schema,
      constants,
      submission,
      evidence,
      evidenceFiles,
      setInputValue,
      setReflectionValue,
      saveEvidence,
      removeEvidence,
      recomputeNow,
      reloadFromStorage,
    }),
    [
      constants,
      evidence,
      evidenceFiles,
      loading,
      removeEvidence,
      recomputeNow,
      reloadFromStorage,
      saveEvidence,
      setInputValue,
      setReflectionValue,
      submission,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}

export function getSectionFields(schemaDef: AssignmentSchema, sectionId: string): AssignmentField[] {
  return schemaDef.fields.filter((field) => field.section_id === sectionId);
}

export function isReflectionRole(field: AssignmentField): boolean {
  return isReflectionField(field);
}
