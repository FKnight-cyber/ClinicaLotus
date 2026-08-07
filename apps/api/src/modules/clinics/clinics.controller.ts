import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { ClinicsService } from "./clinics.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { ListClinicsQueryDto } from "./dto/list-clinics-query.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateClinicStatusDto } from "./dto/update-clinic-status.dto";

@Controller("clinics")
@UseGuards(AuthGuard, PermissionsGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  @RequirePermissions("clinics.read")
  list(@Query() query: ListClinicsQueryDto) {
    return this.clinicsService.list(query);
  }

  @Post()
  @RequirePermissions("clinics.manage")
  create(@Body() dto: CreateClinicDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.clinicsService.create(dto, request.user?.id);
  }

  @Get(":clinicId")
  @RequirePermissions("clinics.read")
  getById(@Param("clinicId") clinicId: string) {
    return this.clinicsService.getById(clinicId);
  }

  @Patch(":clinicId/status")
  @RequirePermissions("clinics.manage")
  updateStatus(@Param("clinicId") clinicId: string, @Body() dto: UpdateClinicStatusDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.clinicsService.updateStatus(clinicId, dto, request.user?.id);
  }

  @Patch(":clinicId")
  @RequirePermissions("clinics.manage")
  update(@Param("clinicId") clinicId: string, @Body() dto: UpdateClinicDto, @Req() request: { user?: AuthenticatedUser }) {
    return this.clinicsService.update(clinicId, dto, request.user?.id);
  }
}
