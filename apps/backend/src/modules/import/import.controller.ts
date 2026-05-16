import { Controller, Post, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ImportService } from './import.service';

@UseGuards(AuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  @Post('cars')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importCars(@UploadedFile() file: Express.Multer.File) {
    return this.svc.importCars(file.buffer);
  }

  @Post('customers')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importCustomers(@UploadedFile() file: Express.Multer.File) {
    return this.svc.importCustomers(file.buffer);
  }
}
