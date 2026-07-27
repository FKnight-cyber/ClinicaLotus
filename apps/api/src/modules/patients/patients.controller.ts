import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { UpdatePatientStatusDto } from "./dto/update-patient-status.dto";
import { PatientsService } from "./patients.service";

@Controller("patients")
@UseGuards(AuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions("patients.read")
  list(@Query("search") search?: string, @Query("status") status?: string, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.patientsService.list(search, { status, limit, offset });
  }

  @Post()
  @RequirePermissions("patients.create")
  create(@Req() request: { user?: AuthenticatedUser }, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(request.user?.id, dto);
  }

  @Get(":patientId")
  @RequirePermissions("patients.read")
  getById(@Param("patientId") patientId: string, @Req() request: { user: AuthenticatedUser }) {
    return this.patientsService.getById(patientId, request.user.permissions);
  }

  @Post(":patientId/report/pdf")
  @RequirePermissions("patients.read")
  emitSummaryReportDocument(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string) {
    return this.patientsService.emitSummaryReportDocument(request.user.id, patientId, request.user.permissions);
  }

  @Patch(":patientId")
  @RequirePermissions("patients.update")
  update(@Req() request: { user?: AuthenticatedUser }, @Param("patientId") patientId: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(request.user?.id, patientId, dto);
  }

  @Patch(":patientId/status")
  @RequirePermissions("patients.inactivate")
  updateStatus(@Req() request: { user?: AuthenticatedUser }, @Param("patientId") patientId: string, @Body() dto: UpdatePatientStatusDto) {
    return this.patientsService.updateStatus(request.user?.id, patientId, dto.status);
  }

  @Get(":patientId/prontuario")
  @RequirePermissions("prontuario.read")
  getMedicalRecord(@Param("patientId") patientId: string, @Req() request: { user: AuthenticatedUser }, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.patientsService.getMedicalRecord(patientId, request.user.permissions, { limit, offset });
  }
}