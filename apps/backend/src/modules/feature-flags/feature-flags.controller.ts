import { Controller, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { FeatureFlagsService } from './feature-flags.service';

@UseGuards(AuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get() list() { return this.svc.list(); }

  @Put(':key')
  upsert(
    @Param('key') key: string,
    @Body() dto: { enabled: boolean; rolloutPct?: number; roles?: string[] },
  ) {
    return this.svc.upsert(key, dto.enabled, dto.rolloutPct ?? 100, dto.roles ?? []);
  }

  @Delete(':key') delete(@Param('key') key: string) { return this.svc.delete(key); }
}
