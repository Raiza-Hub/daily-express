import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { Request, Response, NextFunction } from "express";
import multer from "multer";

interface File extends Express.Multer.File {}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export const cloudinaryUpload = async (
  file: File,
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "daily-express/drivers",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as CloudinaryUploadResult);
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
    // Simple way: find the version (starts with 'v' followed by digits) or the first segment that doesn't look like a transformation
    let publicIdSegments = parts.slice(uploadIndex + 1);

    // Skip transformation segments (they usually don't contain 'v' followed by digits at the start of the path unless it's version)
    // Actually, Cloudinary IDs can be complex. Let's use a more robust split.
    // The public ID is everything from the version (or after transformations) until the extension.
    
    // Find version segment if it exists
    const versionIndex = publicIdSegments.findIndex(seg => /^v\d+$/.test(seg));
    if (versionIndex !== -1) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1);
    } else {
      // If no version, skip transformations (segments that contain ',')
      // Note: This is an approximation. More robust: public IDs for this project always start with 'daily-express'
      const folderIndex = publicIdSegments.findIndex(seg => seg === "daily-express");
      if (folderIndex !== -1) {
        publicIdSegments = publicIdSegments.slice(folderIndex);
      }
    }

    const publicIdWithExt = publicIdSegments.join("/");
    // Remove the extension
    return publicIdWithExt.replace(/\.[^/.]+$/, "");
  } catch (error) {
    console.error("Error extracting Cloudinary public ID:", error);
    return null;
  }
};

export const cloudinaryDelete = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Failed to delete image from Cloudinary:", error);
  }
};

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MulterRequest extends Request {
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
      cloudinaryUpload(req.file as File)
        .then((result) => {
          req.body.profile_pic = result.secure_url;
          next();
        })
        .catch(() => {
          res.status(500).json({
            success: false,
            error: "Failed to upload image",
          });
          return;
        });
    } else {
      next();
    }
  });
};
