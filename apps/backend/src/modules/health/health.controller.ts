import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.1',
    };
  }
}
