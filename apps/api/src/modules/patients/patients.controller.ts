import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { PatientsService } from "./patients.service";

@Controller("patients")
@UseGuards(AuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions("patients.read")
  list(@Query("search") search?: string) {
    return this.patientsService.list(search);
  }

  @Post()
  @RequirePermissions("patients.create")
  create(@Req() request: { user?: AuthenticatedUser }, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(request.user?.id, dto);
  }

  @Get(":patientId/prontuario")
  @RequirePermissions("prontuario.read")
  getMedicalRecord(@Param("patientId") patientId: string) {
    return this.patientsService.getMedicalRecord(patientId);
  }
}