# Migration Plan: Cloudinary → Cloudflare R2 (Presigned URLs)

## Current Architecture

```
Client → API (multer/buffer) → Cloudinary upload → driver.profile_pic
               ↑                          ↑
         Base64 stored in           Worker decodes,
         driver_profile_image       uploads to Cloudinary,
         _upload table              updates driver record
```

**Problems:**
1. File bytes pass through your API server (double bandwidth, memory pressure)
2. Async worker + `driver_profile_image_upload` table (350 lines of complexity)
3. Base64 encoding/decoding (33% size bloat)
4. 4 files to touch for one photo upload (controller → service → repository → worker)

## Target Architecture

```
Client → R2 (presigned PUT) → API (confirm) → driver.profile_pic
           ↑                         ↑
     Direct upload to R2      Validates with HeadObject,
     with time-limited URL     updates driver record instantly
```

**Gains:**
- Zero file bytes through your API server
- No worker, no base64, no `driver_profile_image_upload` table
- Profile pic updates synchronously and instantly
- -500 lines of code

---

## Step 1: Install Dependencies

```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
bun remove cloudinary multer @types/multer
```

R2 uses the S3 API — same SDK, just a different endpoint.

## Step 2: Environment Variables

Add these to Railway (`railway variables set KEY=value`):

| Variable | Example |
|---|---|
| `R2_ENDPOINT` | `https://abc123.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | From R2 dashboard → API Tokens |
| `R2_SECRET_ACCESS_KEY` | From R2 dashboard → API Tokens |
| `R2_BUCKET` | `daily-express-profiles` |
| `R2_PUBLIC_URL` | `https://profiles.yourdomain.com` |

## Step 3: Create `driver/r2-profile.service.ts` (~50 lines)

```ts
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

  async generateUploadUrl(driverId: string, contentType: string, contentLength: number) {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }
    if (contentLength > MAX_SIZE) {
      throw new Error("File size exceeds 10MB limit");
    }

    const key = `profiles/${driverId}/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: getConfig().R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: "public, max-age=86400",
    });

    const uploadUrl = await getSignedUrl(this.r2, command, { expiresIn: 900 });
    return { uploadUrl, key };
  }

  async confirmUpload(key: string) {
    await this.r2.send(new HeadObjectCommand({
      Bucket: getConfig().R2_BUCKET,
      Key: key,
    }));
    const publicUrl = `${getConfig().R2_PUBLIC_URL}/${key}`;
    return { publicUrl, key };
  }
}

export const r2ProfileService = new R2ProfileService();
```

## Step 4: Update `driver.controller.ts`

Add two new handlers:

```ts
// POST /api/v1/drivers/profile/presign
export const presignProfileUpload: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return sendErrorResponse(res, 401, "Please sign in again.", { code: "AUTHENTICATION_REQUIRED" });
    }

    const driver = await driverRepository.findDriverByUserId(gatewayUser.userId);
    if (!driver) {
      return sendErrorResponse(res, 404, "Driver not found.", { code: "DRIVER_NOT_FOUND" });
    }

    const { contentType, contentLength } = req.body;
    if (!contentType || !contentLength) {
      return sendErrorResponse(res, 400, "contentType and contentLength are required.", { code: "MISSING_FIELDS" });
    }

    const result = await r2ProfileService.generateUploadUrl(driver.id, contentType, contentLength);
    return res.status(200).json(createSuccessResponse(result));
  },
);

// POST /api/v1/drivers/profile/confirm
export const confirmProfileUpload: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return sendErrorResponse(res, 401, "Please sign in again.", { code: "AUTHENTICATION_REQUIRED" });
    }

    const { key } = req.body;
    if (!key) {
      return sendErrorResponse(res, 400, "key is required.", { code: "MISSING_KEY" });
    }

    const { publicUrl } = await r2ProfileService.confirmUpload(key);

    const updated = await driverRepository.updateDriverStandalone(gatewayUser.userId, {
      profile_pic: publicUrl,
      updatedAt: new Date(),
    });

    return res.status(200).json(
      createSuccessResponse({ profile_pic: publicUrl }, "Profile picture updated successfully"),
    );
  },
);
```

## Step 5: Wire Routes in `driver.routes.ts`

```ts
import { cloudinaryMiddleware } from "./cloudinary"; // ← will remove later

router.post("/profile/presign", presignProfileUpload);
router.post("/profile/confirm", confirmProfileUpload);

// Existing routes: remove cloudinaryMiddleware, accept key in body instead
router.post("/", createDriver);       // was: cloudinaryMiddleware, createDriver
router.put("/", updateDriver);        // was: cloudinaryMiddleware, updateDriver
```

## Step 6: Update `driver-profile.service.ts`

Remove `profileImageUpload` parameter from `createDriver` and `updateDriver`. Remove `enqueueProfileImageUpload`. Remove `withProfilePictureUpload`. Remove `DriverProfileImageUploadFile` import.

The controller will no longer pass upload data to these methods — the frontend calls `/presign` → `/confirm` separately.

## Step 7: Update Frontend (`apps/web`)

Current flow (simplified):
```
1. User selects file → multipart POST to /api/v1/drivers with form data
2. Backend stores base64 in driver_profile_image_upload
3. Worker processes async → Cloudinary → updates driver.profile_pic
4. Frontend polls / retries to see updated picture
```

New flow:
```
1. User selects file
2. POST /api/v1/drivers/profile/presign → { uploadUrl, key }
3. PUT file directly to uploadUrl (fetch with Content-Type header)
4. POST /api/v1/drivers/profile/confirm → { key } → { profile_pic }
5. Update local state with returned profile_pic URL
```

The driver profile create/update forms no longer include the image file — they can be submitted before, after, or in parallel with the upload.

## Step 8: Remove Deprecated Files

| File | Lines | Why |
|---|---|---|
| `driver/cloudinary.ts` | 185 | Entire Cloudinary integration |
| `workers/driver-profile-upload.worker.ts` | 350 | Worker + DLQ for async uploads |
| `driver.repository.ts` — `insertProfileImageUpload` | ~15 | Table insert method |
| `db/driver-schema.ts` — `driverProfileImageUpload` table + enum | ~40 | Schema definition |
| `db/index.ts` — exports | ~2 | Type export |

Create migration `0007_drop_driver_profile_image_upload.sql`:

```sql
DROP TABLE "driver_profile_image_upload";
DROP TYPE "driver_profile_image_upload_status";
```

Remove from `package.json`:

```bash
bun remove cloudinary multer @types/multer
```

## Step 9: R2 Bucket Setup

1. **Create bucket** in Cloudflare R2: `daily-express-profiles`

2. **Create API token** with `Object Read & Write` permission on the bucket

3. **Set CORS policy**:
```json
[
  {
    "AllowedOrigins": ["https://your-frontend.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"]
  }
]
```

4. **Set up custom domain** (optional but recommended):
   - Go to R2 bucket → Settings → Public Access
   - Connect a custom domain (e.g. `profiles.yourdomain.com`)
   - Proxy through Cloudflare (orange cloud) for CDN caching
   - Set `R2_PUBLIC_URL` to `https://profiles.yourdomain.com`

## Summary of Changes

| Category | Files Changed | Lines |
|---|---|---|
| New | `driver/r2-profile.service.ts` | +50 |
| Modified | `driver.controller.ts`, `driver.routes.ts`, `driver-profile.service.ts`, config | ~+50 |
| Removed | `cloudinary.ts`, `driver-profile-upload.worker.ts`, schema table + enum | -600 |
| Frontend | Upload flow rewrite | varies |

**Net: ~-500 lines, zero runtime infrastructure, instant profile pic updates.**