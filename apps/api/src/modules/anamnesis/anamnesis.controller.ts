import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateAnamnesisDto } from "./dto/create-anamnesis.dto";
import { AnamnesisService } from "./anamnesis.service";

@Controller("anamneses")
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Get("templates")
  getTemplates() {
    return this.anamnesisService.getTemplates();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.anamnesisService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateAnamnesisDto) {
    return this.anamnesisService.create(dto);
  }
}