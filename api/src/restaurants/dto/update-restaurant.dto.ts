import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  // Both accept an explicit `null` (clear the field) as distinct from the key
  // being absent (leave it unchanged) — @IsOptional() lets null/undefined skip
  // the @IsUrl check either way.
  // require_tld: false — local dev serves Supabase Storage off an IP host
  // (e.g. http://192.168.1.63:54321/...), which has no TLD to validate.
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string | null;
}
