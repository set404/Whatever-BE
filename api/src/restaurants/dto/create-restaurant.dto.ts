import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Populated by the FE after it uploads the file to Supabase Storage directly —
  // this API never handles the image bytes themselves.
  // require_tld: false — local dev serves Supabase Storage off an IP host
  // (e.g. http://192.168.1.63:54321/...), which has no TLD to validate.
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;
}
