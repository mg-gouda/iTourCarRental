import { Module } from '@nestjs/common';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PartsController],
  providers: [PartsService],
})
export class PartsModule {}
