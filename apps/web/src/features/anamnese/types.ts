export type TemplateId = "nursing-admission" | "psychological" | "therapeutic-initial";

export type FieldType = "text" | "textarea" | "date" | "time" | "number" | "yesNo" | "yesNoDetails" | "singleChoice" | "multiChoice" | "table";

export type TableColumn = {
  id: string;
  label: string;
};

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  rows?: string[];
  columns?: TableColumn[];
  helper?: string;
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormTemplate = {
  id: TemplateId;
  title: string;
  shortTitle: string;
  source: string;
  description: string;
  sections: FormSection[];
};

export type TableValue = Record<string, Record<string, string>>;
export type ConditionalValue = {
  answer?: string;
  details?: string;
};
export type FieldValue = string | string[] | TableValue | ConditionalValue;
export type TemplateAnswers = Record<string, FieldValue>;

export type AnamneseStatus = "draft" | "finalized";

export type AnamneseRecord = {
  id: string;
  code: string;
  status: AnamneseStatus;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  patientName: string;
  answers: Record<TemplateId, TemplateAnswers>;
  customFields?: Partial<Record<TemplateId, Record<string, FormField[]>>>;
};

export type ValidationIssue = {
  templateTitle: string;
  sectionTitle: string;
  fieldLabel: string;
};