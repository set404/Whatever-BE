import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Issues presigned PUT URLs against Cloudflare R2 (S3-compatible) — the FE
 * uploads bytes directly to R2, this service never touches the file itself.
 */
@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET');
    this.publicUrl = this.config
      .getOrThrow<string>('R2_PUBLIC_URL')
      .replace(/\/$/, '');
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async createRestaurantImageUploadUrl(
    groupId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
    const key = `${groupId}/${randomUUID()}.${extension}`;

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { uploadUrl, publicUrl: `${this.publicUrl}/${key}` };
  }
}
