import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Populated by the FE after it uploads the file to R2 directly (see
  // UploadsController) — this API never handles the image bytes themselves.
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;
}
