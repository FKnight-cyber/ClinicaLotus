import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./guards/auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import type { AuthenticatedUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: { user: AuthenticatedUser }) {
    return this.authService.getProfile(request.user.id);
  }
}