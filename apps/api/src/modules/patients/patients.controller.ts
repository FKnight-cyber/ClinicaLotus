import { createReadStream } from "node:fs";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequirePermissions } from "../auth/guards/permissions.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { UpdatePatientStatusDto } from "./dto/update-patient-status.dto";
import { PatientsService, type PatientFileUpload } from "./patients.service";

@Controller("patients")
@UseGuards(AuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions("patients.read")
  list(@Req() request: { user: AuthenticatedUser }, @Query("search") search?: string, @Query("status") status?: string, @Query("limit") limit?: string, @Query("offset") offset?: string, @Query("clinicId") clinicId?: string, @Query("clinicScope") clinicScope?: string, @Query("admissionDate") admissionDate?: string, @Query("dischargeDate") dischargeDate?: string, @Query("sortBy") sortBy?: string, @Query("sortDirection") sortDirection?: string) {
    return this.patientsService.list(request.user, search, { status, limit, offset, clinicId, clinicScope, admissionDate, dischargeDate, sortBy, sortDirection });
  }

  @Post()
  @RequirePermissions("patients.create")
  create(@Req() request: { user: AuthenticatedUser }, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(request.user, dto);
  }

  @Post(":patientId/files/:fileType")
  @RequirePermissions("patients.files.edit")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Param("fileType") fileType: string, @UploadedFile() file: PatientFileUpload | undefined, @Query("clinicId") clinicId?: string) {
    return this.patientsService.uploadFile(request.user, patientId, fileType, file, clinicId);
  }

  @Get(":patientId/files/:fileType")
  @RequirePermissions("patients.files.read")
  async downloadFile(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Param("fileType") fileType: string, @Query("clinicId") clinicId?: string) {
    const file = await this.patientsService.getFileForDownload(request.user, patientId, fileType, clinicId);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    });
  }

  @Delete(":patientId/files/:fileType")
  @RequirePermissions("patients.files.edit")
  removeFile(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Param("fileType") fileType: string, @Query("clinicId") clinicId?: string) {
    return this.patientsService.removeFile(request.user, patientId, fileType, clinicId);
  }

  @Get(":patientId")
  @RequirePermissions("patients.read")
  getById(@Param("patientId") patientId: string, @Req() request: { user: AuthenticatedUser }, @Query("clinicId") clinicId?: string, @Query("clinicScope") clinicScope?: string) {
    return this.patientsService.getById(patientId, request.user, clinicId, clinicScope);
  }

  @Post(":patientId/report/pdf")
  @RequirePermissions("patients.read")
  emitSummaryReportDocument(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Query("clinicId") clinicId?: string) {
    return this.patientsService.emitSummaryReportDocument(request.user, patientId, clinicId);
  }

  @Patch(":patientId")
  @RequirePermissions("patients.update")
  update(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Body() dto: UpdatePatientDto, @Query("clinicId") clinicId?: string) {
    return this.patientsService.update(request.user, patientId, dto, clinicId);
  }

  @Patch(":patientId/status")
  @RequirePermissions("patients.inactivate")
  updateStatus(@Req() request: { user: AuthenticatedUser }, @Param("patientId") patientId: string, @Body() dto: UpdatePatientStatusDto, @Query("clinicId") clinicId?: string) {
    return this.patientsService.updateStatus(request.user, patientId, dto.status, clinicId);
  }

  @Get(":patientId/prontuario")
  @RequirePermissions("prontuario.read")
  getMedicalRecord(@Param("patientId") patientId: string, @Req() request: { user: AuthenticatedUser }, @Query("limit") limit?: string, @Query("offset") offset?: string, @Query("clinicId") clinicId?: string, @Query("clinicScope") clinicScope?: string) {
    return this.patientsService.getMedicalRecord(patientId, request.user, { limit, offset, clinicId, clinicScope });
  }
}