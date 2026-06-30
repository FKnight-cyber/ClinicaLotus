import templates from "../../../../../shared/anamnese-templates.json";
import type { FormTemplate } from "./types";

export const anamneseTemplates = templates as FormTemplate[];

export function getTemplateById(id: string) {
  return anamneseTemplates.find((template) => template.id === id);
}
