import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateAnamnesisDto } from "./dto/create-anamnesis.dto";
import { UpdateAnamnesisDto } from "./dto/update-anamnesis.dto";
import { AnamnesisService } from "./anamnesis.service";

@Controller("anamneses")
@UseGuards(AuthGuard, PermissionsGuard)
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Get("templates")
  @RequirePermissions("anamnese.read")
  getTemplates() {
    return this.anamnesisService.getTemplates();
  }

  @Get()
  @RequirePermissions("anamnese.read")
  list() {
    return this.anamnesisService.list();
  }

  @Get(":id")
  @RequirePermissions("anamnese.read")
  getById(@Param("id") id: string) {
    return this.anamnesisService.getById(id);
  }

  @Post()
  @RequirePermissions("anamnese.create")
  create(@Req() request: { user: AuthenticatedUser }, @Body() dto: CreateAnamnesisDto) {
    return this.anamnesisService.create(request.user.id, dto);
  }

  @Patch(":id")
  @RequirePermissions("anamnese.update")
  update(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Body() dto: UpdateAnamnesisDto) {
    return this.anamnesisService.update(request.user.id, id, dto);
  }

  @Post(":id/finalize")
  @RequirePermissions("anamnese.finalize")
  finalize(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string) {
    return this.anamnesisService.finalize(request.user.id, id);
  }
}