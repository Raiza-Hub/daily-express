import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { getConfig } from "../config/index";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export class R2ProfileService {
  private r2: S3Client;

  constructor() {
    const config = getConfig();
    this.r2 = new S3Client({
      region: "auto",
      endpoint: config.R2_ENDPOINT,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async generateUploadUrl(id: string, contentType: string, contentLength: number) {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }
    if (contentLength > MAX_SIZE) {
      throw new Error("File size exceeds 10MB limit");
    }

    const ext = contentType.split("/")[1];
    const key = `profiles/${id}/${randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: getConfig().R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: "public, max-age=86400",
    });

    const uploadUrl = await getSignedUrl(this.r2, command, { expiresIn: 900 });
    const publicUrl = `${getConfig().R2_PUBLIC_URL}/${key}`;
    return { uploadUrl, key, publicUrl };
  }

  async confirmUpload(key: string) {
    const config = getConfig();
    await this.r2.send(new HeadObjectCommand({
      Bucket: config.R2_BUCKET,
      Key: key,
    }));
    const publicUrl = `${config.R2_PUBLIC_URL}/${key}`;
    return { publicUrl, key };
  }
}

export const r2ProfileService = new R2ProfileService();
