import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { logger } from "../utils/logger";

export interface File extends Express.Multer.File {}

export interface DriverProfileImageUploadFile {
  fileName: string | null;
  mimeType: string;
  size: number;
  fileBase64: string;
}

export interface DriverProfileImageUploadRequest extends Request {
  profileImageUpload?: DriverProfileImageUploadFile;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

interface CloudinaryUploadResponse extends CloudinaryUploadResult {
  eager?: Array<{ secure_url?: string }>;
}

const DRIVER_PROFILE_IMAGE_FOLDER = "daily-express/drivers";

const DRIVER_PROFILE_IMAGE_TRANSFORMATION = {
  width: 1024,
  height: 1024,
  crop: "limit",
  quality: "auto:good",
} as const;

const DRIVER_PROFILE_AVATAR_TRANSFORMATION = {
  width: 256,
  height: 256,
  crop: "fill",
  gravity: "auto",
  quality: "auto:good",
  format: "webp",
} as const;

export const cloudinaryUpload = async (
  file: File,
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: DRIVER_PROFILE_IMAGE_FOLDER,
        resource_type: "image",
        format: "webp",
        transformation: DRIVER_PROFILE_IMAGE_TRANSFORMATION,
        eager: [DRIVER_PROFILE_AVATAR_TRANSFORMATION],
      },
      (error, result) => {
        if (error) reject(error);
        else if (!result) reject(new Error("Cloudinary upload returned no result"));
        else {
          const uploadResult = result as CloudinaryUploadResponse;
          resolve({
            public_id: uploadResult.public_id,
            secure_url: uploadResult.eager?.[0]?.secure_url || uploadResult.secure_url,
          });
        }
      },
    );
    Readable.from(file.buffer).pipe(uploadStream);
  });
};

export const extractPublicIdFromUrl = (url: string): string | null => {
  if (!url || !url.includes("cloudinary.com")) return null;

  try {
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((part) => part === "upload");

    if (uploadIndex === -1) return null;

    // The segments after 'upload/' contain transformations, the version (optional), and the public_id
    let publicIdSegments = parts.slice(uploadIndex + 1);

    // Skip transformation segments (they usually don't contain 'v' followed by digits at the start of the path unless it's version)
    const versionIndex = publicIdSegments.findIndex(seg => /^v\d+$/.test(seg));
    if (versionIndex !== -1) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1);
    }

    const publicIdWithExt = publicIdSegments.join("/");
    // Remove the extension
    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch (error) {
    logger.warn("cloudinary.public_id_extract_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const cloudinaryDelete = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface MulterRequest extends DriverProfileImageUploadRequest {
  file?: File;
}

export const cloudinaryMiddleware = (
  req: MulterRequest,
  res: Response,
  next: NextFunction,
): void => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
      }
    },
  });

  upload.single("file")(req, res, (err): void => {
    if (err) {
      res.status(400).json({
        success: false,
        error: err.message || "File upload failed",
      });
      return;
    }

    if (req.file) {
      req.profileImageUpload = {
        fileName: req.file.originalname || null,
        mimeType: req.file.mimetype,
        size: req.file.size,
        fileBase64: req.file.buffer.toString("base64"),
      };
    }

    next();
  });
};
