import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Mirrors the constraints the old Supabase Storage bucket policy enforced.
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Stores restaurant photos directly in Postgres and serves them back out. */
@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  async storeRestaurantImage(
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    if (
      !ALLOWED_IMAGE_CONTENT_TYPES.includes(
        file.mimetype as (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Unsupported image type');
    }

    const image = await this.prisma.image.create({
      data: { data: new Uint8Array(file.buffer), contentType: file.mimetype },
    });
    return { id: image.id };
  }

  async getImage(
    id: string,
  ): Promise<{ data: Uint8Array; contentType: string }> {
    const image = await this.prisma.image.findUnique({
      where: { id },
      select: { data: true, contentType: true },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    return image;
  }
}
