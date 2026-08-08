import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica" });
const prisma = new PrismaClient({ adapter });

const moduleMenuItems = [
  ["anamnese", "Anamnese"],
  ["acolhimento", "Acolhimento"],
  ["prontuario", "Prontuario"],
  ["agendamento", "Agendamento"],
  ["atendimento", "Atendimento"],
  ["cadastros", "Cadastros"],
  ["controle-acesso", "Controle de acesso"],
  ["auditoria", "Auditoria"],
  ["relatorios", "Relatorios"],
  ["pacientes", "Pacientes"],
  ["configuracoes", "Configuracoes"],
  ["institucional", "Clinica"]
];

const menuVisibilityPermissions = moduleMenuItems.map(([slug, label]) => [
  `menu.${slug}.view`,
  "menu",
  `view_${slug.replaceAll("-", "_")}`,
  `Visualizar ${label} no menu lateral`
]);

const basePermissions = [
  ["anamnese.read", "anamnese", "read", "Visualizar anamneses"],
  ["anamnese.create", "anamnese", "create", "Criar anamneses"],
  ["anamnese.update", "anamnese", "update", "Editar anamneses e customizar perguntas/opções"],
  ["anamnese.finalize", "anamnese", "finalize", "Finalizar anamneses"],
  ["anamnese.print", "anamnese", "print", "Imprimir/exportar anamneses"],
  ["anamnese.clinic_filter", "anamnese", "clinic_filter", "Filtrar anamneses por clínica"],
  ["anamnese.templates.nursing.read", "anamnese", "read_template_nursing", "Visualizar ficha de Enfermagem"],
  ["anamnese.templates.psychological.read", "anamnese", "read_template_psychological", "Visualizar ficha Psicológica"],
  ["anamnese.templates.therapeutic.read", "anamnese", "read_template_therapeutic", "Visualizar ficha Terapêutica"],
  ["patients.read", "patients", "read", "Visualizar pacientes"],
  ["patients.clinic_filter", "patients", "clinic_filter", "Filtrar pacientes por clínica"],
  ["patients.create", "patients", "create", "Cadastrar pacientes"],
  ["patients.update", "patients", "update", "Editar pacientes"],
  ["patients.inactivate", "patients", "inactivate", "Ativar e inativar pacientes"],
  ["prontuario.read", "prontuario", "read", "Visualizar prontuário"],
  ["prontuario.read_network", "prontuario", "read_network", "Visualizar prontuário consolidado da rede"],
  ["medical_evolutions.read", "medical_evolutions", "read", "Visualizar evoluções"],
  ["medical_evolutions.create", "medical_evolutions", "create", "Criar evoluções"],
  ["medical_evolutions.update", "medical_evolutions", "update", "Editar rascunhos de evoluções"],
  ["medical_evolutions.finalize", "medical_evolutions", "finalize", "Finalizar evoluções"],
  ["medical_evolutions.cancel", "medical_evolutions", "cancel", "Cancelar evoluções"],
  ["medical_evolutions.print", "medical_evolutions", "print", "Imprimir/exportar evoluções"],
  ["medical_evolutions.clinic_filter", "medical_evolutions", "clinic_filter", "Filtrar evoluções por clínica"],
  ["profile.medical_info.read", "profile", "read_medical_info", "Adicionar campos de registro profissional ( Médicos )"],
  ["access.users.read", "access", "read_users", "Visualizar usuários"],
  ["access.users.manage", "access", "manage_users", "Gerenciar usuários"],
  ["access.groups.read", "access", "read_groups", "Visualizar grupos de acesso"],
  ["access.groups.manage", "access", "manage_groups", "Gerenciar grupos e permissões"],
  ["access.password_changes.read", "access", "read_password_changes", "Visualizar pedidos de alteração de senha"],
  ["access.password_changes.manage", "access", "manage_password_changes", "Aprovar e cancelar pedidos de alteração de senha"],
  ["audit.access.read", "audit", "read_access_logs", "Visualizar logs do controle de acessos"],
  ["audit.anamnesis.read", "audit", "read_anamnesis_logs", "Visualizar logs de anamnese"],
  ["audit.medical_evolutions.read", "audit", "read_medical_evolution_logs", "Visualizar logs de evoluções finalizadas"],
  ["audit.patients.read", "audit", "read_patient_logs", "Visualizar logs de pacientes"],
  ["clinics.read", "clinics", "read", "Visualizar clínicas"],
  ["clinics.manage", "clinics", "manage", "Gerenciar clínicas"],
  ["admin.full_access", "admin", "full_access", "Acesso administrativo total"]
];

const permissions = [...basePermissions, ...menuVisibilityPermissions];

const questionTypeMap = {
  text: "TEXT",
  textarea: "TEXTAREA",
  date: "DATE",
  time: "TIME",
  number: "NUMBER",
  yesNo: "YES_NO",
  yesNoDetails: "YES_NO_DETAILS",
  singleChoice: "SINGLE_CHOICE",
  multiChoice: "MULTI_CHOICE",
  table: "TABLE"
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function syncGroupPermissions(groupId, permissionKeys) {
  const groupPermissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  await prisma.$transaction([
    prisma.accessGroupPermission.deleteMany({ where: { accessGroupId: groupId } }),
    ...groupPermissions.map((permission) => prisma.accessGroupPermission.create({ data: { accessGroupId: groupId, permissionId: permission.id } }))
  ]);
}

async function loadOfficialAnamnesisTemplates() {
  const templatesPath = new URL("../../../shared/anamnese-templates.json", import.meta.url);
  return JSON.parse(await readFile(templatesPath, "utf8"));
}

async function syncQuestionOptions(questionId, options = []) {
  await prisma.$transaction([
    prisma.anamnesisQuestionOption.deleteMany({ where: { questionId } }),
    ...options.map((label, sortOrder) => prisma.anamnesisQuestionOption.create({
      data: { questionId, label, sortOrder, active: true }
    }))
  ]);
}

async function syncQuestionTableRows(questionId, rows = []) {
  await prisma.$transaction([
    prisma.anamnesisQuestionTableRow.deleteMany({ where: { questionId } }),
    ...rows.map((label, sortOrder) => prisma.anamnesisQuestionTableRow.create({
      data: { questionId, label, sortOrder, active: true }
    }))
  ]);
}

async function seedAnamnesisTemplates() {
  const officialTemplates = await loadOfficialAnamnesisTemplates();

  for (const template of officialTemplates) {
    const storedTemplate = await prisma.anamnesisTemplate.upsert({
      where: { key: template.id },
      update: {
        title: template.title,
        shortTitle: template.shortTitle,
        source: template.source,
        description: template.description,
        active: true
      },
      create: {
        key: template.id,
        title: template.title,
        shortTitle: template.shortTitle,
        source: template.source,
        description: template.description,
        active: true
      }
    });

    await prisma.anamnesisSection.updateMany({
      where: { templateId: storedTemplate.id, key: { notIn: template.sections.map((section) => section.id) } },
      data: { active: false }
    });

    for (const [sectionIndex, section] of template.sections.entries()) {
      const storedSection = await prisma.anamnesisSection.upsert({
        where: { templateId_key: { templateId: storedTemplate.id, key: section.id } },
        update: {
          title: section.title,
          description: section.description ?? null,
          sortOrder: sectionIndex,
          active: true
        },
        create: {
          templateId: storedTemplate.id,
          key: section.id,
          title: section.title,
          description: section.description ?? null,
          sortOrder: sectionIndex,
          active: true
        }
      });

      await prisma.anamnesisQuestion.updateMany({
        where: { sectionId: storedSection.id, key: { notIn: section.fields.map((field) => field.id) } },
        data: { active: false }
      });

      for (const [fieldIndex, field] of section.fields.entries()) {
        const storedQuestion = await prisma.anamnesisQuestion.upsert({
          where: { sectionId_key: { sectionId: storedSection.id, key: field.id } },
          update: {
            label: field.label,
            type: questionTypeMap[field.type],
            placeholder: field.placeholder ?? null,
            helper: field.helper ?? null,
            tableColumnsJson: field.columns ? JSON.stringify(field.columns) : null,
            required: Boolean(field.required),
            sortOrder: fieldIndex,
            active: true
          },
          create: {
            sectionId: storedSection.id,
            key: field.id,
            label: field.label,
            type: questionTypeMap[field.type],
            placeholder: field.placeholder ?? null,
            helper: field.helper ?? null,
            tableColumnsJson: field.columns ? JSON.stringify(field.columns) : null,
            required: Boolean(field.required),
            sortOrder: fieldIndex,
            active: true
          }
        });

        await syncQuestionOptions(storedQuestion.id, field.options ?? []);
        await syncQuestionTableRows(storedQuestion.id, field.rows ?? []);
      }
    }
  }

  await prisma.anamnesisTemplate.updateMany({
    where: { key: { notIn: officialTemplates.map((template) => template.id) } },
    data: { active: false }
  });
}

async function seedDefaultClinic() {
  const defaultClinic = await prisma.clinic.upsert({
    where: { code: "CLINICA-1" },
    update: { name: "Clínica 1", document: "00.000.000/0001-00", status: "ACTIVE" },
    create: { name: "Clínica 1", code: "CLINICA-1", document: "00.000.000/0001-00", status: "ACTIVE" }
  });

  const accessGroups = await prisma.accessGroup.findMany({ select: { id: true } });
  for (const accessGroup of accessGroups) {
    await prisma.accessGroupClinic.upsert({
      where: { accessGroupId_clinicId: { accessGroupId: accessGroup.id, clinicId: defaultClinic.id } },
      update: {},
      create: { accessGroupId: accessGroup.id, clinicId: defaultClinic.id }
    });
  }

  return defaultClinic;
}

async function main() {
  for (const [key, module, action, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { module, action, description, active: true },
      create: { key, module, action, description, active: true }
    });
  }

  const developerGroup = await prisma.accessGroup.upsert({
    where: { name: "Developer" },
    update: { active: true, description: "Grupo tecnico com todos os acessos do sistema." },
    create: { name: "Developer", description: "Grupo tecnico com todos os acessos do sistema.", active: true }
  });

  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: "Administrador" },
    update: { active: true, description: "Grupo administrativo sem visibilidade total do menu lateral." },
    create: { name: "Administrador", description: "Grupo administrativo sem visibilidade total do menu lateral.", active: true }
  });

  const allPermissions = await prisma.permission.findMany();
  await syncGroupPermissions(developerGroup.id, allPermissions.map((permission) => permission.key));
  await syncGroupPermissions(adminGroup.id, [...basePermissions.map(([key]) => key), "menu.anamnese.view"]);

  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const admin = await prisma.user.upsert({
    where: { login: "admin" },
    update: { status: "ACTIVE" },
    create: {
      login: "admin",
      name: "Administrador",
      email: "admin@flordelotus.local",
      passwordHash: hashPassword(adminPassword),
      status: "ACTIVE",
      mustChangePassword: true
    }
  });

  await prisma.userAccessGroup.upsert({
    where: { userId_accessGroupId: { userId: admin.id, accessGroupId: adminGroup.id } },
    update: {},
    create: { userId: admin.id, accessGroupId: adminGroup.id }
  });

  await prisma.userAccessGroup.upsert({
    where: { userId_accessGroupId: { userId: admin.id, accessGroupId: developerGroup.id } },
    update: {},
    create: { userId: admin.id, accessGroupId: developerGroup.id }
  });

  await seedDefaultClinic();
  await seedAnamnesisTemplates();

  console.log(`Seed concluído. Login inicial: admin / ${adminPassword}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });