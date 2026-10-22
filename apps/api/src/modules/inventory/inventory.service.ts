import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateInventoryEntryDto } from "./dto/create-inventory-entry.dto";
import { ListInventoryEntriesQueryDto } from "./dto/list-inventory-entries-query.dto";
import { UpdateInventoryEntryDto } from "./dto/update-inventory-entry.dto";

const defaultListLimit = 40;
const maxListLimit = 100;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly cache: AppCacheService) {}

  async list(user: AuthenticatedUser, query: ListInventoryEntriesQueryDto) {
    const clinicIds = this.resolveClinicIds(user, query.clinicId);
    const limit = Math.min(Math.max(query.limit ?? defaultListLimit, 1), maxListLimit);
    const page = Math.max(query.page ?? 1, 1);
    const search = query.search?.trim() ?? "";
    const from = this.parseDate(query.from, false);
    const to = this.parseDate(query.to, true);
    if (from && to && from > to) throw new BadRequestException("O início do período deve anteceder o fim.");
    const where: Prisma.InventoryEntryWhereInput = {
      clinicId: { in: clinicIds },
      ...(search ? { productName: { contains: search, mode: "insensitive" } } : {}),
      ...(from || to ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {})
    };
    const cacheKey = `inventory:entries:${clinicIds.slice().sort().join(",")}:${limit}:${page}:${search.toLowerCase()}:${query.from ?? ""}:${query.to ?? ""}`;

    return this.cache.getOrSet(cacheKey, 15_000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.inventoryEntry.findMany({
          where,
          orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: { clinic: { select: { id: true, name: true } } }
        }),
        this.prisma.inventoryEntry.count({ where })
      ]);
      return { items, total, limit, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });
  }

  async create(user: AuthenticatedUser, dto: CreateInventoryEntryDto) {
    const clinicId = this.resolveClinicIds(user, dto.clinicId)[0];
    const productName = dto.productName.trim();
    if (!productName) throw new BadRequestException("Informe o nome do produto.");
    const entryDate = new Date(dto.entryDate);
    if (Number.isNaN(entryDate.getTime())) throw new BadRequestException("Informe uma data de entrada válida.");

    const entry = await this.prisma.inventoryEntry.create({
      data: { clinicId, productName, quantity: dto.quantity, unitPrice: dto.unitPrice.toFixed(2), entryDate, createdById: user.id },
      include: { clinic: { select: { id: true, name: true } } }
    });
    this.cache.deleteByPrefix("inventory:entries:");
    await this.prisma.auditLog.create({
      data: {
        entity: "inventory_entry",
        entityId: entry.id,
        action: "create_inventory_entry",
        afterData: JSON.stringify({ ...entry, unitPrice: entry.unitPrice.toString() }),
        reason: `Entrada de estoque registrada: ${entry.productName}`,
        userId: user.id,
        clinicId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
    return entry;
  }

  async update(user: AuthenticatedUser, entryId: string, dto: UpdateInventoryEntryDto) {
    const clinicIds = this.resolveClinicIds(user);
    const previousEntry = await this.prisma.inventoryEntry.findFirst({
      where: { id: entryId, clinicId: { in: clinicIds } },
      include: { clinic: { select: { id: true, name: true } } }
    });
    if (!previousEntry) throw new BadRequestException("Entrada de estoque não encontrada no escopo do usuário.");

    const data: Prisma.InventoryEntryUpdateInput = {};
    if (dto.productName !== undefined) {
      const productName = dto.productName.trim();
      if (!productName) throw new BadRequestException("Informe o nome do produto.");
      data.productName = productName;
    }
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) data.unitPrice = dto.unitPrice.toFixed(2);
    if (dto.entryDate !== undefined) {
      const entryDate = new Date(dto.entryDate);
      if (Number.isNaN(entryDate.getTime())) throw new BadRequestException("Informe uma data de entrada válida.");
      data.entryDate = entryDate;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException("Informe ao menos um campo para atualizar.");

    const nextEntry = await this.prisma.inventoryEntry.update({
      where: { id: entryId },
      data,
      include: { clinic: { select: { id: true, name: true } } }
    });
    this.cache.deleteByPrefix("inventory:entries:");
    await this.prisma.auditLog.create({
      data: {
        entity: "inventory_entry",
        entityId: nextEntry.id,
        action: "update_inventory_entry",
        beforeData: JSON.stringify({ ...previousEntry, unitPrice: previousEntry.unitPrice.toString() }),
        afterData: JSON.stringify({ ...nextEntry, unitPrice: nextEntry.unitPrice.toString() }),
        reason: `Entrada de estoque atualizada: ${nextEntry.productName}`,
        userId: user.id,
        clinicId: nextEntry.clinicId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
    return nextEntry;
  }

  private resolveClinicIds(user: AuthenticatedUser, requestedClinicId?: string) {
    if (!user.availableClinicIds.length) throw new BadRequestException("Usuário sem clínica disponível.");
    if (requestedClinicId?.trim()) {
      if (!user.availableClinicIds.includes(requestedClinicId.trim())) throw new BadRequestException("Clínica fora do escopo do usuário.");
      return [requestedClinicId.trim()];
    }
    return user.availableClinicIds;
  }

  private parseDate(value: string | undefined, exclusiveEnd: boolean) {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException("Período de entrada contém uma data inválida.");
    if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
    return date;
  }
}