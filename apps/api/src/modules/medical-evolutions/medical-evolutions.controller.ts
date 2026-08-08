import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { CancelMedicalEvolutionDto } from "./dto/cancel-medical-evolution.dto";
import { CreateMedicalEvolutionDto } from "./dto/create-medical-evolution.dto";
import { UpdateMedicalEvolutionDto } from "./dto/update-medical-evolution.dto";
import { MedicalEvolutionsService } from "./medical-evolutions.service";

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class MedicalEvolutionsController {
  constructor(private readonly medicalEvolutionsService: MedicalEvolutionsService) {}

  @Get("patients/:patientId/evolutions")
  @RequirePermissions("medical_evolutions.read")
  listByPatient(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Query("limit") limit?: string, @Query("offset") offset?: string, @Query("clinicId") clinicId?: string, @Query("clinicScope") clinicScope?: string) {
    return this.medicalEvolutionsService.listByPatient(request.user, patientId, { limit, offset, clinicId, clinicScope });
  }

  @Post("patients/:patientId/evolutions")
  @RequirePermissions("medical_evolutions.create")
  create(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Body() dto: CreateMedicalEvolutionDto) {
    return this.medicalEvolutionsService.create(request.user, patientId, dto);
  }

  @Get("medical-evolutions/:id")
  @RequirePermissions("medical_evolutions.read")
  getById(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Query("clinicId") clinicId?: string) {
    return this.medicalEvolutionsService.getById(request.user, id, clinicId);
  }

  @Patch("medical-evolutions/:id")
  @RequirePermissions("medical_evolutions.update")
  update(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Body() dto: UpdateMedicalEvolutionDto, @Query("clinicId") clinicId?: string) {
    return this.medicalEvolutionsService.update(request.user, id, dto, clinicId);
  }

  @Post("medical-evolutions/:id/finalize")
  @RequirePermissions("medical_evolutions.finalize")
  finalize(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Query("clinicId") clinicId?: string) {
    return this.medicalEvolutionsService.finalize(request.user, id, clinicId);
  }

  @Post("medical-evolutions/:id/cancel")
  @RequirePermissions("medical_evolutions.cancel")
  cancel(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Body() dto: CancelMedicalEvolutionDto, @Query("clinicId") clinicId?: string) {
    return this.medicalEvolutionsService.cancel(request.user, id, dto, clinicId);
  }

  @Post("medical-evolutions/:id/documents/pdf")
  @RequirePermissions("medical_evolutions.print")
  emitPdfDocument(@Req() request: { user: AuthenticatedUser }, @Param("id") id: string, @Query("clinicId") clinicId?: string) {
    return this.medicalEvolutionsService.emitPdfDocument(request.user, id, clinicId);
  }
}