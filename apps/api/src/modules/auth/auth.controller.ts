import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./guards/auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import type { AuthenticatedUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: { user: AuthenticatedUser }) {
    return this.authService.getProfile(request.user.id);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  updateMe(@Req() request: { user: AuthenticatedUser }, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(request.user.id, dto);
  }
}