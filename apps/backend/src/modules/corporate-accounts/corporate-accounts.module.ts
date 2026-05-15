import { Module } from '@nestjs/common';
import { CorporateAccountsController } from './corporate-accounts.controller';
import { CorporateAccountsService } from './corporate-accounts.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CorporateAccountsController],
  providers: [CorporateAccountsService],
  exports: [CorporateAccountsService],
})
export class CorporateAccountsModule {}
