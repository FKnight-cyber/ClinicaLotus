import { createHash, randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica" });
const prisma = new PrismaClient({ adapter });

const permissions = [
  ["anamnese.read", "anamnese", "read", "Visualizar anamneses"],
  ["anamnese.create", "anamnese", "create", "Criar anamneses"],
  ["anamnese.update", "anamnese", "update", "Editar anamneses e customizar perguntas/opções"],
  ["anamnese.finalize", "anamnese", "finalize", "Finalizar anamneses"],
  ["anamnese.print", "anamnese", "print", "Imprimir/exportar anamneses"],
  ["access.users.read", "access", "read_users", "Visualizar usuários"],
  ["access.users.manage", "access", "manage_users", "Gerenciar usuários"],
  ["access.groups.read", "access", "read_groups", "Visualizar grupos de acesso"],
  ["access.groups.manage", "access", "manage_groups", "Gerenciar grupos e permissões"],
  ["admin.full_access", "admin", "full_access", "Acesso administrativo total"]
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  for (const [key, module, action, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { module, action, description, active: true },
      create: { key, module, action, description, active: true }
    });
  }

  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: "Administrador" },
    update: { active: true, description: "Grupo com acesso total ao sistema." },
    create: { name: "Administrador", description: "Grupo com acesso total ao sistema.", active: true }
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.accessGroupPermission.upsert({
      where: { accessGroupId_permissionId: { accessGroupId: adminGroup.id, permissionId: permission.id } },
      update: {},
      create: { accessGroupId: adminGroup.id, permissionId: permission.id }
    });
  }

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

  console.log(`Seed concluído. Login inicial: admin / ${adminPassword}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });