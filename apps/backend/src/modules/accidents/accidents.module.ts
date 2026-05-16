import { Module } from '@nestjs/common';
import { AccidentsController } from './accidents.controller';
import { AccidentsService } from './accidents.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccidentsController],
  providers: [AccidentsService],
})
export class AccidentsModule {}
