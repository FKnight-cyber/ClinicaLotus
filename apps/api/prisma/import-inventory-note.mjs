import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica" });
const prisma = new PrismaClient({ adapter });

const sourceFile = "ITENS PARA NOTA FISCALl.pdf";
const importAction = "import_inventory_pdf_once";

const entries = [
  ["4.2", "2 cadeiras - uma para o paciente e outra para o acompanhante", 2, "49.90"],
  ["4.3", "Cadeira para o médico", 1, "127.99"],
  ["4.4", "Mesa / birô", 1, "689.00"],
  ["4.5", "Pia ou lavabo", 1, "641.00"],
  ["4.6a", "Toalhas de papel", 5, "8.50"],
  ["4.6b", "Sabonete líquido para higiene", 5, "14.99"],
  ["4.7", "Lixeira com tampa acionada por pedal", 1, "59.90"],
  ["4.8", "Esfigmomanômetro", 1, "113.91"],
  ["4.9", "Estetoscópio clínico", 1, "139.90"],
  ["4.10", "Termômetro", 1, "27.30"],
  ["4.11", "Lanterna com pilhas", 1, "26.99"],
  ["4.12", "Abaixadores de língua descartáveis", 100, "9.90"],
  ["4.15", "Maca acolchoada simples, revestida com material impermeável, com lençol", 1, "659.95"],
  ["4.16", "Escada de 2 ou 3 degraus para acesso dos pacientes à maca", 1, "78.00"],
  ["4.17", "Lençóis para as macas", 3, "22.98"],
  ["4.18", "Luvas descartáveis (caixa com 100 unidades)", 100, "26.90"],
  ["4.19", "Otoscópio", 1, "450.00"],
  ["4.20", "Balança antropométrica adequada à faixa etária", 1, "1328.00"],
  ["4.21", "Fita métrica plástica flexível inelástica", 1, "28.13"],
  ["4.22", "Oftalmoscópio", 1, "720.00"],

  ["7.1", "Carrinho de atendimento às emergências", 1, "1899.90"],
  ["7.3", "Oxímetro de pulso", 1, "135.70"],
  ["7.4", "Aspirador de secreções", 1, "512.40"],
  ["7.5", "Ressuscitador manual tipo balão autoinflável com reservatório e máscara", 1, "171.36"],
  ["7.6", "Cânulas / tubos endotraqueais", 4, "5.86"],
  ["7.7", "Cânulas naso ou orofaríngeas", 1, "61.74"],
  ["7.8", "Laringoscópio com lâminas adequadas", 1, "845.12"],
  ["7.9", "Máscara laríngea", 1, "42.75"],
  ["7.10", "Guia para tubo traqueal com pinça condutora", 1, "45.79"],
  ["7.11", "Sondas para aspiração", 2, "2.02"],
  ["7.13", "Seringas, agulhas e equipo para aplicação endovenosa (pacote com 50 unidades)", 6, "54.90"],
  ["7.14", "Fonte de oxigênio fixa ou cilindro com máscara aplicadora e umidificador (250 ml)", 1, "54.26"],
  ["7.16", "Adrenalina", 4, "6.75"],
  ["7.17", "Água destilada", 3, "10.84"],
  ["7.18", "Aminofilina (caixa com 20, 100 mg)", 4, "5.59"],
  ["7.19", "Amiodarona (caixa com 20, 100 mg)", 8, "27.18"],
  ["7.20", "Atropina (0,5 ml)", 12, "11.00"],
  ["7.21", "Cloreto de potássio", 12, "27.59"],
  ["7.22", "Cloreto de sódio (500 ml)", 10, "9.64"],
  ["7.23", "Dexametasona (caixa com 10 comprimidos)", 5, "10.19"],
  ["7.24", "Diazepam (caixa com 30 comprimidos)", 6, "16.49"],
  ["7.25", "Dopamina (5 ml)", 1, "19.43"],
  ["7.26", "Fenitoína (caixa com 30 comprimidos)", 2, "699.00"],
  ["7.27", "Fenobarbital (100 mg, 3x com 30 comprimidos)", 6, "5.74"],
  ["7.28", "Furosemida (caixa com 20 comprimidos)", 5, "27.59"],
  ["7.29", "Glicose", 14, "42.90"],
  ["7.30", "Haloperidol (30 ml)", 3, "17.49"],
  ["7.31", "Hidrocortisona (10 mg)", 7, "21.09"],
  ["7.32", "Lidocaína (50 mg)", 3, "18.14"],
  ["7.33", "Meperidina (ou equivalente)", 4, "1.00"],
  ["7.34", "Midazolam (15 mg, caixa com 30 comprimidos)", 2, "42.99"],
  ["7.35", "Ringer Lactato", 2, "11.40"],
  ["7.36", "Soro glicosofisiológico (50 mg)", 2, "4.14"],
  ["7.37", "Dobutamina", 2, "31.05"],

  ["10.1", "Leitos reguláveis", 3, "2500.00"],
  ["10.2", "Escada de dois ou três degraus para acesso", 1, "78.00"],
  ["10.4", "Biombo médico", 1, "310.00"],
  ["10.5", "EPI para atendimento das intercorrências (luvas, máscaras e óculos)", 2, "29.99"],
  ["10.6", "Suporte para fluido endovenoso", 1, "149.50"],
  ["10.8", "Aspirador de secreções", 1, "512.40"],
  ["10.9", "Cânulas naso ou orofaríngeas (Guedel)", 1, "61.74"],
  ["10.10", "Laringoscópio com lâminas adequadas", 1, "845.12"],
  ["10.11", "Sondas para aspiração", 2, "2.02"],
  ["10.12", "Tubos endotraqueais", 4, "3.23"],
  ["10.22", "Solução fisiológica 0,9% (500 ml)", 10, "9.64"],
  ["10.23", "Solução glicosada 5% (500 ml)", 2, "24.00"],
  ["10.24", "Solução Ringer Lactato (500 ml)", 2, "17.50"],
  ["10.25", "Fonte de oxigênio fixa ou cilindro com máscara aplicadora e umidificador (250 ml)", 1, "54.26"],
  ["10.26", "Oxímetro de pulso", 1, "135.70"],
  ["10.27", "Ventilador / reanimador manual adulto tipo balão autoinflável com reservatório e máscara", 1, "180.38"],
  ["10.28", "Seringas, agulhas e equipo para aplicação endovenosa (pacote com 50 unidades)", 15, "54.90"],
  ["10.29", "Escalpe, butterfly e intracath (com material para introdução)", 10, "3.19"],
  ["10.30", "Gaze / algodão / ataduras de crepe", 11, "9.54"],
  ["10.31", "Luvas estéreis", 4, "1.45"],
  ["10.32", "Caixa rígida coletora para material perfurocortante", 1, "7.46"]
].map(([item, name, quantity, unitPrice]) => ({
  item,
  productName: name,
  quantity,
  unitPrice
}));

function readArguments(args) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      flags.add(argument);
      continue;
    }
    if (!argument.startsWith("--") || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error(`Argumento inválido: ${argument}`);
    }
    values.set(argument, args[index + 1]);
    index += 1;
  }
  return { values, flags };
}

function parseEntryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) throw new Error("Informe --entry-date no formato AAAA-MM-DD.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("A data de entrada informada é inválida.");
  return date;
}

async function main() {
  const { values, flags } = readArguments(process.argv.slice(2));
  const clinicReference = values.get("--clinic");
  const userReference = values.get("--user");
  const entryDate = parseEntryDate(values.get("--entry-date"));

  if (!clinicReference) throw new Error("Informe --clinic com o ID ou código da clínica.");
  if (!userReference) throw new Error("Informe --user com o ID ou login do usuário responsável.");
  const clinic = await prisma.clinic.findFirst({
    where: { OR: [{ id: clinicReference }, { code: clinicReference }], status: "ACTIVE" },
    select: { id: true, name: true }
  });
  if (!clinic) throw new Error(`Clínica ativa não encontrada: ${clinicReference}`);

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: userReference }, { login: userReference }], status: "ACTIVE" },
    select: { id: true, login: true, clinics: { where: { clinicId: clinic.id, status: "ACTIVE" }, select: { clinicId: true } } }
  });
  if (!user || user.clinics.length === 0) throw new Error(`Usuário ativo vinculado à clínica ${clinic.name} não encontrado: ${userReference}`);

  console.log(`Arquivo: ${sourceFile}`);
  console.log(`Clínica: ${clinic.name} (${clinic.id})`);
  console.log(`Responsável: ${user.login} (${user.id})`);
  console.log(`Data de entrada aplicada aos itens: ${values.get("--entry-date")}`);
  console.log(`Entradas completas: ${entries.length}`);
  if (!flags.has("--apply")) {
    console.log("Prévia apenas. Acrescente --apply para gravar; essa importação só pode ser aplicada uma vez.");
    return;
  }

  const importedCount = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7410211021) IS NULL AS locked`;
    const previousImport = await tx.auditLog.findFirst({
      where: { entity: "inventory_import", action: importAction },
      select: { id: true, createdAt: true }
    });
    if (previousImport) throw new Error(`Esta carga já foi executada em ${previousImport.createdAt.toISOString()}. Nenhum item foi inserido.`);

    for (const item of entries) {
      const entry = await tx.inventoryEntry.create({
        data: {
          clinicId: clinic.id,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          entryDate,
          createdById: user.id
        }
      });
      await tx.auditLog.create({
        data: {
          entity: "inventory_entry",
          entityId: entry.id,
          action: "import_inventory_entry",
          afterData: JSON.stringify({ ...entry, unitPrice: entry.unitPrice.toString(), sourceItem: item.item, sourceFile }),
          reason: `Entrada importada do item ${item.item} da lista de nota fiscal`,
          userId: user.id,
          clinicId: clinic.id
        }
      });
    }

    await tx.auditLog.create({
      data: {
        entity: "inventory_import",
        action: importAction,
        afterData: JSON.stringify({ sourceFile, clinicId: clinic.id, importedCount: entries.length, entryDate: values.get("--entry-date") }),
        reason: `Carga única de itens da nota fiscal: ${entries.length} entradas importadas`,
        userId: user.id,
        clinicId: clinic.id
      }
    });
    return entries.length;
  });

  console.log(`Carga concluída: ${importedCount} entradas importadas.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());