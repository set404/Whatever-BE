import { Body, Controller, Post } from '@nestjs/common';
import { CreateRestaurantImageUploadUrlDto } from './dto/create-upload-url.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('restaurant-image')
  createRestaurantImageUploadUrl(
    @Body() dto: CreateRestaurantImageUploadUrlDto,
  ) {
    return this.uploadsService.createRestaurantImageUploadUrl(
      dto.groupId,
      dto.contentType,
    );
  }
}
