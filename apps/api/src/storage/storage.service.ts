import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Bucket: string;
  private readonly s3PresignExpiresSeconds: number;
  private readonly s3Client: S3Client;
  private readonly localStorageDir: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:9000',
    );
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>(
      'S3_ACCESS_KEY_ID',
      'minioadmin',
    );
    const secretAccessKey = this.configService.get<string>(
      'S3_SECRET_ACCESS_KEY',
      'minioadmin',
    );
    const forcePathStyle = this.configService.get<boolean>(
      'S3_FORCE_PATH_STYLE',
      true,
    );

    this.s3Bucket = this.configService.get<string>(
      'S3_BUCKET',
      'emoto-evidence',
    );
    this.s3PresignExpiresSeconds = this.configService.get<number>(
      'S3_PRESIGN_EXPIRES_SECONDS',
      600,
    );
    this.localStorageDir = path.resolve(process.cwd(), 'uploads');

    this.s3Client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  // Ensures configured evidence bucket exists and is usable at module startup.
  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    try {
      fs.mkdirSync(this.localStorageDir, { recursive: true });
    } catch {
      // Ignore directory creation errors
    }

    await this.ensureBucketExists().catch(() => {});
  }

  // Uploads JSON content to configured object storage with local fallback.
  async uploadJson(key: string, payload: unknown): Promise<void> {
    await this.uploadObject(
      key,
      JSON.stringify(payload, null, 2),
      'application/json; charset=utf-8',
    );
  }

  // Uploads plaintext content to configured object storage with local fallback.
  async uploadText(
    key: string,
    payload: string,
    contentType: string,
  ): Promise<void> {
    await this.uploadObject(key, payload, contentType);
  }

  // Generates a short-lived presigned download URL for one object key.
  async createPresignedGetUrl(key: string): Promise<string> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return `https://mock-storage.emoto.local/${this.s3Bucket}/${key}?expires=${this.s3PresignExpiresSeconds}`;
    }

    const localFilePath = path.join(this.localStorageDir, key);
    if (fs.existsSync(localFilePath)) {
      return `/incidents/evidence-file?key=${encodeURIComponent(key)}`;
    }

    try {
      await this.ensureBucketExists();
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: this.s3PresignExpiresSeconds,
      });
    } catch {
      return `/incidents/evidence-file?key=${encodeURIComponent(key)}`;
    }
  }

  // Returns current presigned URL expiry in seconds.
  getPresignedExpirySeconds(): number {
    return this.s3PresignExpiresSeconds;
  }

  // Reads a local evidence file if available.
  readLocalFile(key: string): { content: Buffer; mimeType: string } | null {
    const safePath = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    const localFilePath = path.join(this.localStorageDir, safePath);
    if (!fs.existsSync(localFilePath)) {
      return null;
    }
    const content = fs.readFileSync(localFilePath);
    const mimeType = safePath.endsWith('.csv')
      ? 'text/csv; charset=utf-8'
      : 'application/json; charset=utf-8';
    return { content, mimeType };
  }

  // Uploads one object and ensures bucket existence before writing content.
  private async uploadObject(
    key: string,
    body: string,
    contentType: string,
  ): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      this.logger.debug(`[Mock Storage] Skipped upload for key: ${key}`);
      return;
    }

    // Always store to local disk storage as a reliable fallback
    try {
      const localFilePath = path.join(this.localStorageDir, key);
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
      fs.writeFileSync(localFilePath, body, 'utf-8');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Local file write failed for ${key}: ${message}`);
    }

    try {
      await this.ensureBucketExists();
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`S3 upload skipped, fallback to local disk: ${message}`);
    }
  }

  // Creates the evidence bucket when missing and tolerates transient startup failures.
  private async ensureBucketExists(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.s3Bucket,
        }),
      );
      return;
    } catch {
      // Continue to create bucket when head check fails.
    }

    try {
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.s3Bucket,
        }),
      );
      this.logger.log(`Created storage bucket ${this.s3Bucket}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('BucketAlreadyOwnedByYou') ||
        message.includes('BucketAlreadyExists')
      ) {
        return;
      }
      this.logger.warn(`Storage bucket init failed: ${message}`);
      throw error;
    }
  }
}
