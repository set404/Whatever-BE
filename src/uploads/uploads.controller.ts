import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { UploadsService } from './uploads.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('restaurant-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadRestaurantImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ imageUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const { id } = await this.uploadsService.storeRestaurantImage(file);
    return {
      imageUrl: `${req.protocol}://${req.get('host')}/uploads/images/${id}`,
    };
  }

  @Public()
  @Get('images/:id')
  async getImage(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const image = await this.uploadsService.getImage(id);
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data);
  }
}
