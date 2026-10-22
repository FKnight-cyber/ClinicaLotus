import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { CreateInventoryEntryDto } from "./dto/create-inventory-entry.dto";
import { ListInventoryEntriesQueryDto } from "./dto/list-inventory-entries-query.dto";
import { UpdateInventoryEntryDto } from "./dto/update-inventory-entry.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory/entries")
@UseGuards(AuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions("inventory.read")
  list(@Req() request: { user: AuthenticatedUser }, @Query() query: ListInventoryEntriesQueryDto) {
    return this.inventoryService.list(request.user, query);
  }

  @Post()
  @RequirePermissions("inventory.manage")
  create(@Req() request: { user: AuthenticatedUser }, @Body() dto: CreateInventoryEntryDto) {
    return this.inventoryService.create(request.user, dto);
  }

  @Patch(":entryId")
  @RequirePermissions("inventory.manage")
  update(@Req() request: { user: AuthenticatedUser }, @Param("entryId") entryId: string, @Body() dto: UpdateInventoryEntryDto) {
    return this.inventoryService.update(request.user, entryId, dto);
  }
}