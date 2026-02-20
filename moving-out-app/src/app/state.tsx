/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { removeEvidenceByType, upsertEvidenceForType } from "../evidence/evidenceService";
import { buildSubmissionZip } from "../export/exportZip";
import { restoreFromSubmissionZip } from "../export/importZip";
import { refreshMinimumWageSnapshot as refreshMinimumWageSnapshotService } from "../integrations/minimumWage";
import { refreshTransitSnapshot as refreshTransitSnapshotService } from "../integrations/transitFares";
import { appendEvent } from "../logs/eventLog";
import { listEventLog } from "../logs/eventLog";
import { applyPinnedChoice, createPinnedChoice, removePinnedChoice } from "../pinning/pinningService";
import { computeBudget, computeReadinessFlags } from "../rules";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import type {
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
  clearConstantsOverrides,
  getConstantsOverrides,
  getSubmission,
  listEvidenceFiles,
  listEvidenceItems,
  saveConstantsOverrides,
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
  pinCategory: (category: "housing" | "transportation") => Promise<void>;
  unpinCategory: (category: "housing" | "transportation") => Promise<void>;
  setConstantsOverride: (nextConstants: Constants, changedKeys: string[]) => Promise<void>;
  resetConstantsToDefault: () => Promise<void>;
  refreshTransitSnapshot: () => Promise<number>;
  refreshMinimumWageSnapshot: () => Promise<number>;
  exportSubmissionPackage: () => Promise<Blob>;
  importSubmissionPackage: (zipBlob: Blob) => Promise<void>;
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
  low_vehicle_price: false,
  unsourced_categories: [],
  surplus_or_deficit_amount: 0,
  fix_next: [],
};

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

function getInputNumber(inputs: Submission["inputs"], fieldId: string): number {
  const raw = inputs[fieldId];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function buildDefaultFoodRows(constants: Constants) {
  return constants.food.default_items.map((item, index) => ({
    id: `seed-${index + 1}`,
    item,
    planned_purchase: "",
    estimated_cost: 0,
    source_url: "",
  }));
}

function buildMigratedAnnualRows(args: { label: string; monthlyValue: number }) {
  const { label, monthlyValue } = args;
  const monthly = rounded(monthlyValue);
  const annual = rounded(monthlyValue * 12);
  return [
    {
      id: `legacy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      item: `Migrated ${label} total`,
      quantity_per_year: 1,
      average_cost: annual,
      annual_total: annual,
      monthly_total: monthly,
      source_url: "",
    },
  ];
}

function buildMigratedMonthlyRows(args: { label: string; monthlyValue: number }) {
  const { label, monthlyValue } = args;
  return [
    {
      id: `legacy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      item: `Migrated ${label} total`,
      monthly_total: rounded(monthlyValue),
      source_url: "",
    },
  ];
}

export function migrateSubmissionToCurrentSchema(args: {
  submission: Submission;
  schema: AssignmentSchema;
  constants: Constants;
}): Submission {
  const { submission, schema: schemaDef, constants } = args;
  let changed = false;
  const nextInputs: Submission["inputs"] = { ...submission.inputs };
  const nextReflections: Submission["reflections"] = { ...submission.reflections };

  schemaDef.fields.forEach((field) => {
    if (field.role === "reflection") {
      if (typeof nextReflections[field.id] !== "string") {
        nextReflections[field.id] = "";
        changed = true;
      }
      return;
    }
    if (field.role !== "input") {
      return;
    }
    if (field.id in nextInputs) {
      return;
    }
    changed = true;
    if (field.type === "checkbox") {
      nextInputs[field.id] = false;
      return;
    }
    if (field.id === "income_mode") {
      nextInputs[field.id] = constants.income.default_mode;
      return;
    }
    if (field.id === "paycheques_per_month") {
      nextInputs[field.id] = 2;
      return;
    }
    if (field.id === "transport_mode") {
      nextInputs[field.id] = "car";
      return;
    }
    if (field.id === "food_table_weekly") {
      nextInputs[field.id] = JSON.stringify(buildDefaultFoodRows(constants));
      return;
    }
    nextInputs[field.id] = null;
  });

  const foodTableRaw = nextInputs.food_table_weekly;
  if (typeof foodTableRaw !== "string" || foodTableRaw.trim().length === 0) {
    nextInputs.food_table_weekly = JSON.stringify(buildDefaultFoodRows(constants));
    changed = true;
  }

  const clothingRaw = nextInputs.clothing_table_annual;
  if ((typeof clothingRaw !== "string" || clothingRaw.trim().length === 0) && getInputNumber(nextInputs, "clothing_monthly") > 0) {
    nextInputs.clothing_table_annual = JSON.stringify(
      buildMigratedAnnualRows({
        label: "clothing",
        monthlyValue: getInputNumber(nextInputs, "clothing_monthly"),
      }),
    );
    changed = true;
  }

  const healthRaw = nextInputs.health_hygiene_table_annual;
  if ((typeof healthRaw !== "string" || healthRaw.trim().length === 0) && getInputNumber(nextInputs, "health_hygiene_monthly") > 0) {
    nextInputs.health_hygiene_table_annual = JSON.stringify(
      buildMigratedAnnualRows({
        label: "health hygiene",
        monthlyValue: getInputNumber(nextInputs, "health_hygiene_monthly"),
      }),
    );
    changed = true;
  }

  const recreationRaw = nextInputs.recreation_table_annual;
  if ((typeof recreationRaw !== "string" || recreationRaw.trim().length === 0) && getInputNumber(nextInputs, "recreation_monthly") > 0) {
    nextInputs.recreation_table_annual = JSON.stringify(
      buildMigratedAnnualRows({
        label: "recreation",
        monthlyValue: getInputNumber(nextInputs, "recreation_monthly"),
      }),
    );
    changed = true;
  }

  const miscRaw = nextInputs.misc_table_monthly;
  if ((typeof miscRaw !== "string" || miscRaw.trim().length === 0) && getInputNumber(nextInputs, "misc_monthly") > 0) {
    nextInputs.misc_table_monthly = JSON.stringify(
      buildMigratedMonthlyRows({
        label: "misc",
        monthlyValue: getInputNumber(nextInputs, "misc_monthly"),
      }),
    );
    changed = true;
  }

  const versionChanged =
    submission.schema_version !== schemaDef.schema_version ||
    submission.constants_version !== constants.constants_version;

  if (!changed && !versionChanged) {
    return submission;
  }

  return {
    ...submission,
    schema_version: schemaDef.schema_version,
    constants_version: constants.constants_version,
    inputs: nextInputs,
    reflections: nextReflections,
    updated_at: new Date().toISOString(),
  };
}

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
      if (field.type === "checkbox") {
        inputs[field.id] = false;
        return;
      }
      if (field.id === "income_mode") {
        inputs[field.id] = constants.income.default_mode;
        return;
      }
      if (field.id === "paycheques_per_month") {
        inputs[field.id] = 2;
        return;
      }
      if (field.id === "transport_mode") {
        inputs[field.id] = "car";
        return;
      }
      if (field.id === "food_table_weekly") {
        inputs[field.id] = JSON.stringify(buildDefaultFoodRows(constants));
        return;
      }
      inputs[field.id] = null;
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

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [constants, setConstantsState] = useState<Constants>(defaultConstants);
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
    const migrated = migrateSubmissionToCurrentSchema({
      submission: baseSubmission,
      schema,
      constants: activeConstants,
    });
    const hydrated = recomputeSubmission({
      submission: migrated,
      schema,
      constants: activeConstants,
      evidence: evidenceItems,
    });

    setConstantsState(activeConstants);
    setEvidence(evidenceItems);
    setEvidenceFiles(files);
    setSubmission(hydrated);
    await saveSubmission(hydrated);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const pinCategory = useCallback(
    async (category: "housing" | "transportation") => {
      const pinnedChoice = createPinnedChoice({
        category,
        schema,
        submission,
      });
      const withPinned = applyPinnedChoice({
        submission,
        pinnedChoice,
      });
      const recomputed = recomputeSubmission({
        submission: withPinned,
        schema,
        constants,
        evidence,
      });
      await appendEvent("PIN_ADD", {
        category,
        pin_id: pinnedChoice.id,
      });
      await persistSubmission(recomputed);
    },
    [constants, evidence, persistSubmission, submission],
  );

  const unpinCategory = useCallback(
    async (category: "housing" | "transportation") => {
      const unpinned = removePinnedChoice({
        submission,
        category,
      });
      const recomputed = recomputeSubmission({
        submission: unpinned,
        schema,
        constants,
        evidence,
      });
      await appendEvent("PIN_REMOVE", { category });
      await persistSubmission(recomputed);
    },
    [constants, evidence, persistSubmission, submission],
  );

  const setConstantsOverride = useCallback(
    async (nextConstants: Constants, changedKeys: string[]) => {
      await saveConstantsOverrides(nextConstants);
      setConstantsState(nextConstants);
      const recomputed = recomputeSubmission({
        submission,
        schema,
        constants: nextConstants,
        evidence,
      });
      await appendEvent("CONSTANTS_EDIT", {
        changed_keys: changedKeys,
        constants_version: nextConstants.constants_version,
      });
      await persistSubmission(recomputed);
    },
    [evidence, persistSubmission, submission],
  );

  const resetConstantsToDefault = useCallback(async () => {
    await clearConstantsOverrides();
    setConstantsState(defaultConstants);
    const recomputed = recomputeSubmission({
      submission,
      schema,
      constants: defaultConstants,
      evidence,
    });
    await appendEvent("CONSTANTS_EDIT", {
      reset_to_default: true,
      constants_version: defaultConstants.constants_version,
    });
    await persistSubmission(recomputed);
  }, [evidence, persistSubmission, submission]);

  const exportSubmissionPackage = useCallback(async (): Promise<Blob> => {
    await appendEvent("EXPORT", {
      submission_id: submission.id,
      pinned_count: submission.pinned.length,
    });
    const eventLog = await listEventLog();
    const bytes = await buildSubmissionZip({
      submission,
      schema,
      constants,
      evidenceItems: evidence,
      evidenceFiles,
      eventLog,
    });
    const zipBytes = new Uint8Array(bytes.byteLength);
    zipBytes.set(bytes);
    return new Blob([zipBytes], { type: "application/zip" });
  }, [constants, evidence, evidenceFiles, submission]);

  const importSubmissionPackage = useCallback(
    async (zipBlob: Blob): Promise<void> => {
      await restoreFromSubmissionZip(zipBlob);
      await reloadFromStorage();
    },
    [reloadFromStorage],
  );

  const refreshTransitSnapshot = useCallback(async (): Promise<number> => {
    const refreshed = await refreshTransitSnapshotService(constants);
    await setConstantsOverride(refreshed.constants, ["transportation.transit_monthly_pass_default"]);
    return refreshed.monthlyCap;
  }, [constants, setConstantsOverride]);

  const refreshMinimumWageSnapshot = useCallback(async (): Promise<number> => {
    const refreshed = await refreshMinimumWageSnapshotService(constants);
    await setConstantsOverride(refreshed.constants, ["economic_snapshot.minimum_wage_ab"]);
    return refreshed.wage;
  }, [constants, setConstantsOverride]);

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
      pinCategory,
      unpinCategory,
      setConstantsOverride,
      resetConstantsToDefault,
      refreshTransitSnapshot,
      refreshMinimumWageSnapshot,
      exportSubmissionPackage,
      importSubmissionPackage,
      recomputeNow,
      reloadFromStorage,
    }),
    [
      constants,
      evidence,
      evidenceFiles,
      exportSubmissionPackage,
      importSubmissionPackage,
      loading,
      removeEvidence,
      pinCategory,
      refreshTransitSnapshot,
      refreshMinimumWageSnapshot,
      resetConstantsToDefault,
      recomputeNow,
      reloadFromStorage,
      saveEvidence,
      setConstantsOverride,
      setInputValue,
      setReflectionValue,
      submission,
      unpinCategory,
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
