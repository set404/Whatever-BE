import { IsIn, IsString, IsUUID } from 'class-validator';

// Mirrors the constraints the old Supabase Storage bucket policy enforced.
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export class CreateRestaurantImageUploadUrlDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @IsIn(ALLOWED_IMAGE_CONTENT_TYPES)
  contentType: string;
}
