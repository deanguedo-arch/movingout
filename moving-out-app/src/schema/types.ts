export type FieldRole = "input" | "derived" | "reflection";
export type FieldType =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "checkbox"
  | "food_table"
  | "expense_table";
export type EvidenceType = "rental_ad" | "vehicle_ad" | "other";

export type SectionGuide = {
  what_this_part: string;
  updated_for_today: string;
  how_to_research: string;
};

export type AssignmentSection = {
  id: string;
  title: string;
  description?: string;
  points?: number;
  guide?: SectionGuide;
};

export type AssignmentFieldValidation = {
  min?: number;
  max?: number;
  step?: number;
  min_length?: number;
  max_length?: number;
};

export type AssignmentFieldOption = {
  label: string;
  value: string;
};

export type AssignmentFieldUi = {
  placeholder?: string;
  help_text?: string;
  prefix?: string;
  read_only?: boolean;
  info_title?: string;
  info_blurb?: string;
  info_source_url?: string;
  info_source_label?: string;
  source_for_field_id?: string;
  table_columns?: Array<{
    id: string;
    label: string;
    type: "text" | "number" | "url" | "select" | "derived";
    options?: AssignmentFieldOption[];
    derived_formula?: "qty_x_unit_to_annual" | "annual_div_12" | "sum_column";
    source_column_id?: string;
  }>;
  default_rows?: number;
};

export type AssignmentField = {
  id: string;
  section_id: string;
  label: string;
  type: FieldType;
  role: FieldRole;
  required: boolean;
  compute_key?: string;
  validation?: AssignmentFieldValidation;
  options?: AssignmentFieldOption[];
  ui?: AssignmentFieldUi;
};

export type EvidenceRequirement = {
  id: EvidenceType;
  label: string;
  description?: string;
  required: boolean;
  section_id: string;
};

export type PinCategoryConfig = {
  id: "housing" | "transportation";
  section_id: string;
  label_field_id: string;
  snapshot_field_ids: string[];
};

export type AssignmentSchema = {
  schema_version: string;
  title: string;
  description?: string;
  sections: AssignmentSection[];
  fields: AssignmentField[];
  evidence_requirements: EvidenceRequirement[];
  pinning: {
    categories: PinCategoryConfig[];
  };
};

export type NumericConstant = {
  value: number;
  description: string;
};

export type LoanPaymentPoint = {
  principal: number;
  monthly_payment: number;
};

export type Constants = {
  schema_version: string;
  constants_version: string;
  dataset_date: string;
  currency: string;
  income: {
    default_mode: "net_paycheque" | "hourly_estimate";
    cra_pdoc_url: string;
  };
  deductions: {
    income_tax_rate: NumericConstant;
    cpp_rate: NumericConstant;
    ei_rate: NumericConstant;
    union_dues_rate: NumericConstant;
  };
  thresholds: {
    affordability_housing_fraction_of_net: NumericConstant;
    buffer_warning_threshold: NumericConstant;
  };
  transportation: {
    weeks_per_month: NumericConstant;
    default_down_payment_fraction: NumericConstant;
    default_term_months: NumericConstant;
    default_apr_percent: NumericConstant;
    minimum_vehicle_price: NumericConstant;
    transit_monthly_pass_default: NumericConstant;
    transit_monthly_pass_source_url: string;
    transit_monthly_pass_last_updated: string;
    operating_cost_per_km: {
      car: NumericConstant;
      truck: NumericConstant;
      transit: NumericConstant;
    };
    loan_payment_table: {
      description: string;
      baseline_term_months: number;
      baseline_apr_percent: number;
      points: LoanPaymentPoint[];
    };
  };
  food: {
    weeks_per_month: NumericConstant;
    default_items: string[];
  };
  economic_snapshot: {
    minimum_wage_ab: NumericConstant & {
      source_url: string;
      last_updated: string;
    };
    gas_benchmark_ab: NumericConstant & {
      source_url: string;
      last_updated: string;
    };
    cpi_yoy_canada: NumericConstant & {
      source_url: string;
      last_updated: string;
    };
  };
  teacher_mode: {
    default_passcode: string;
  };
};

export type InputValue = string | number | boolean | null;
export type InputMap = Record<string, InputValue>;
export type ReflectionMap = Record<string, string>;

export type DeductionTotals = {
  income_tax: number;
  cpp: number;
  ei: number;
  union_dues: number;
  total: number;
};

export type DerivedTotals = {
  gross_monthly_income: number;
  net_monthly_income: number;
  deductions: DeductionTotals;
  housing: {
    rent: number;
    utilities: number;
    renter_insurance: number;
    internet_phone: number;
    other: number;
    total: number;
    affordability_ratio: number;
  };
  transportation: {
    mode: "car" | "truck" | "transit";
    vehicle_price: number;
    down_payment: number;
    financed_principal: number;
    term_months: number;
    apr_percent: number;
    loan_payment: number;
    fuel_economy_l_per_100km: number;
    gas_price_per_litre: number;
    km_per_month: number;
    fuel_cost: number;
    maintenance: number;
    operating_cost: number;
    insurance: number;
    parking: number;
    transit_pass: number;
    total: number;
  };
  living_expenses: {
    groceries_weekly: number;
    groceries: number;
    clothing: number;
    household_maintenance: number;
    health_hygiene: number;
    recreation: number;
    savings: number;
    misc: number;
    total: number;
  };
  total_monthly_expenses: number;
  monthly_surplus: number;
};

export type ReadinessFlags = {
  missing_required_fields: string[];
  missing_required_evidence: EvidenceType[];
  affordability_fail: boolean;
  deficit: boolean;
  fragile_buffer: boolean;
  low_vehicle_price: boolean;
  unsourced_categories: string[];
  surplus_or_deficit_amount: number;
  fix_next: string[];
};

export type PinnedChoice = {
  id: string;
  category: "housing" | "transportation";
  label: string;
  snapshot: Record<string, unknown>;
  evidence_ids: string[];
  pinned_at: string;
};

export type Submission = {
  id: string;
  schema_version: string;
  constants_version: string;
  student: {
    name?: string;
    class?: string;
    teacher?: string;
  };
  inputs: InputMap;
  reflections: ReflectionMap;
  derived: DerivedTotals;
  flags: ReadinessFlags;
  pinned: PinnedChoice[];
  evidence_refs: Record<string, string[]>;
  updated_at: string;
};

export type EvidenceFile = {
  id: string;
  evidence_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
  blob: Blob;
};

export type EvidenceItem = {
  id: string;
  type: EvidenceType;
  url?: string;
  file_ids: string[];
  created_at: string;
};

export type EventType =
  | "FIELD_EDIT"
  | "EVIDENCE_ADD"
  | "EVIDENCE_REMOVE"
  | "COMPUTE_RUN"
  | "PIN_ADD"
  | "PIN_REMOVE"
  | "EXPORT"
  | "IMPORT"
  | "CONSTANTS_EDIT";

export type EventLogEntry = {
  seq: number;
  timestamp: string;
  event_type: EventType;
  payload: Record<string, unknown>;
};

export type FoodTableRow = {
  id: string;
  item: string;
  planned_purchase: string;
  estimated_cost: number;
  source_url: string;
};

export type ExpenseTableRow = {
  id: string;
  item: string;
  quantity_per_year?: number;
  average_cost?: number;
  annual_total?: number;
  monthly_total?: number;
  source_url: string;
};
