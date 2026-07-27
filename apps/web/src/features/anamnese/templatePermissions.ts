import type { FormTemplate, TemplateConfigItem } from "./types";

const templatePermissionById: Record<string, string> = {
  "nursing-admission": "anamnese.templates.nursing.read",
  psychological: "anamnese.templates.psychological.read",
  "therapeutic-initial": "anamnese.templates.therapeutic.read"
};

export function canAccessAnamneseTemplate(templateId: string | undefined, permissions: string[]) {
  if (!templateId) return true;
  const permission = templatePermissionById[templateId];
  if (!permission) return true;
  return permissions.includes("admin.full_access") || permissions.includes(permission);
}

export function filterAnamneseTemplatesByPermissions(templates: FormTemplate[], permissions: string[]) {
  return templates.filter((template) => canAccessAnamneseTemplate(template.id, permissions));
}

export function filterAnamneseTemplateConfigByPermissions(templateConfig: TemplateConfigItem[] | undefined, permissions: string[]) {
  return templateConfig?.filter((config) => canAccessAnamneseTemplate(config.id, permissions));
}