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
