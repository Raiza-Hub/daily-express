import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { Readable } from "stream";
import { sentryServer } from "@shared/sentry";
import { db } from "../db/connection";
import { driver, driverProfileImageUpload } from "../db/index";
import {
  cloudinaryDelete,
  cloudinaryUpload,
  extractPublicIdFromUrl,
  type File,
} from "../driver/cloudinary";
import { notificationService } from "../notification/notification.service";
import { publishNotificationCreated } from "../notification/realtime";
import { logger } from "../utils/logger";
import {
  getBoss,
  QUEUES,
  type DriverProfileImageUploadJobData,
} from "./boss";



function decodeUploadBase64(record: typeof driverProfileImageUpload.$inferSelect) {
  const fileBase64 = record.fileBase64.trim();
  const isBase64 =
    fileBase64.length > 0 &&
    fileBase64.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      fileBase64,
    );

  if (!isBase64) {
    throw new Error("Stored profile image payload is not valid base64");
  }

  const buffer = Buffer.from(fileBase64, "base64");
  if (buffer.length !== record.size) {
    throw new Error("Stored profile image payload size does not match metadata");
  }

  return buffer;
}

function buildUploadFile(record: typeof driverProfileImageUpload.$inferSelect): File {
  const buffer = decodeUploadBase64(record);

  return {
    fieldname: "file",
    originalname: record.fileName || "driver-profile-image",
    encoding: "7bit",
    mimetype: record.mimeType,
    size: record.size,
    buffer,
    destination: "",
    filename: record.fileName || "driver-profile-image",
    path: "",
    stream: Readable.from(buffer),
  };
}

async function createUploadNotification(input: {
  driverId: string;
  uploadId: string;
  success: boolean;
  errorMessage?: string | null;
}) {
  const notification = await db.transaction(async (tx) =>
    notificationService.createForDriverInTransaction(tx, input.driverId, {
      notificationKey: `profile:picture:upload:${input.uploadId}:${
        input.success ? "success" : "failed"
      }`,
      kind: "event",
      type: input.success
        ? "profile_picture_upload_succeeded"
        : "profile_picture_upload_failed",
      title: input.success
        ? "Profile picture updated"
        : "Profile picture upload failed",
      message: input.success
        ? "Your profile picture has been updated."
        : "Profile picture upload failed. Please retry uploading the picture.",
      href: "/settings/accounts",
      tag: input.success ? "Profile" : "Action needed",
      tone: input.success ? "positive" : "critical",
      metadata: {
        uploadId: input.uploadId,
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      },
      occurredAt: new Date(),
    }),
  );

  await publishNotificationCreated(notification);
}

async function processUpload(uploadId: string) {
  const uploadRecord = await db.query.driverProfileImageUpload.findFirst({
    where: eq(driverProfileImageUpload.id, uploadId),
  });

  if (!uploadRecord || uploadRecord.status === "succeeded") {
    return;
  }

  const driverRecord = await db.query.driver.findFirst({
    where: eq(driver.id, uploadRecord.driverId),
  });

  if (!driverRecord) {
    await db
      .update(driverProfileImageUpload)
      .set({
        status: "failed",
        errorMessage: "Driver no longer exists",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(driverProfileImageUpload.id, uploadId));
    return;
  }

  const newerUpload = await db.query.driverProfileImageUpload.findFirst({
    where: and(
      eq(driverProfileImageUpload.driverId, uploadRecord.driverId),
      gt(driverProfileImageUpload.createdAt, uploadRecord.createdAt),
      ne(driverProfileImageUpload.id, uploadId),
    ),
  });

  if (newerUpload) {
    await db
      .update(driverProfileImageUpload)
      .set({
        status: "failed",
        errorMessage: "Profile picture upload was superseded by a newer upload.",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(driverProfileImageUpload.id, uploadId));
    return;
  }

  await db
    .update(driverProfileImageUpload)
    .set({
      status: "processing",
      attempts: uploadRecord.attempts + 1,
      updatedAt: new Date(),
    })
    .where(eq(driverProfileImageUpload.id, uploadId));

  let uploaded: Awaited<ReturnType<typeof cloudinaryUpload>>;

  try {
    uploaded = await cloudinaryUpload(buildUploadFile(uploadRecord));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(driverProfileImageUpload)
      .set({
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(driverProfileImageUpload.id, uploadId));
    throw error;
  }

  let profilePictureUpdated = false;

  await db.transaction(async (tx) => {
    const updatedDrivers = await tx
      .update(driver)
      .set({
        profile_pic: uploaded.secure_url,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(driver.id, uploadRecord.driverId),
          uploadRecord.oldProfilePictureUrl
            ? eq(driver.profile_pic, uploadRecord.oldProfilePictureUrl)
            : isNull(driver.profile_pic),
        ),
      )
      .returning({ id: driver.id });

    profilePictureUpdated = updatedDrivers.length > 0;

    await tx
      .update(driverProfileImageUpload)
      .set({
        status: profilePictureUpdated ? "succeeded" : "failed",
        secureUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        errorMessage: profilePictureUpdated
          ? null
          : "Profile picture upload was superseded by a newer upload.",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(driverProfileImageUpload.id, uploadId));
  });

  if (!profilePictureUpdated) {
    try {
      await cloudinaryDelete(uploaded.public_id);
    } catch (error) {
      logger.error("driver.profile_image.superseded_cloudinary_delete_failed", {
        uploadId,
        driverId: uploadRecord.driverId,
        publicId: uploaded.public_id,
        error: error instanceof Error ? error.message : String(error),
      });
      sentryServer.captureException(error, uploadRecord.driverId, {
        action: "deleteSupersededDriverProfileImage",
        uploadId,
        publicId: uploaded.public_id,
      });
    }
    return;
  }

  await createUploadNotification({
    driverId: uploadRecord.driverId,
    uploadId,
    success: true,
  });

  const oldPublicId = uploadRecord.oldProfilePictureUrl
    ? extractPublicIdFromUrl(uploadRecord.oldProfilePictureUrl)
    : null;

  if (!oldPublicId || oldPublicId === uploaded.public_id) {
    return;
  }

  try {
    await cloudinaryDelete(oldPublicId);
  } catch (error) {
    logger.error("driver.profile_image.old_cloudinary_delete_failed", {
      uploadId,
      driverId: uploadRecord.driverId,
      oldPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
    sentryServer.captureException(error, uploadRecord.driverId, {
      action: "deleteOldDriverProfileImage",
      uploadId,
      oldPublicId,
    });
  }
}

async function processUploadDlq(uploadId: string) {
  const [updated] = await db
    .update(driverProfileImageUpload)
    .set({
      status: "failed",
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(driverProfileImageUpload.id, uploadId),
        eq(driverProfileImageUpload.status, "processing"),
      ),
    )
    .returning();

  const uploadRecord =
    updated ||
    (await db.query.driverProfileImageUpload.findFirst({
      where: eq(driverProfileImageUpload.id, uploadId),
    }));

  if (!uploadRecord || uploadRecord.status === "succeeded") {
    return;
  }

  await createUploadNotification({
    driverId: uploadRecord.driverId,
    uploadId,
    success: false,
    errorMessage: uploadRecord.errorMessage,
  });
}

export async function registerDriverProfileUploadWorker() {
  const boss = await getBoss();

  await boss.work<DriverProfileImageUploadJobData>(
    QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD,
    {
      batchSize: 1,
      localConcurrency: 2,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.driver_profile_upload.started", {
        jobId: job.id,
        uploadId: job.data.uploadId,
      });

      try {
        await processUpload(job.data.uploadId);
      } catch (error) {
        logger.error("worker.driver_profile_upload.failed", {
          jobId: job.id,
          uploadId: job.data.uploadId,
          error: error instanceof Error ? error.message : String(error),
        });
        sentryServer.captureException(error, "system", {
          action: "driverProfileUpload",
          uploadId: job.data.uploadId,
          jobId: job.id,
        });
        throw error;
      }
    },
  );

  await boss.work<DriverProfileImageUploadJobData>(
    QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD_DLQ,
    {
      batchSize: 1,
      localConcurrency: 2,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.error("worker.driver_profile_upload.dlq", {
        jobId: job.id,
        uploadId: job.data.uploadId,
      });

      sentryServer.captureException(
        new Error("Driver profile image upload moved to DLQ"),
        "system",
        {
          action: "driverProfileUploadDlq",
          uploadId: job.data.uploadId,
          jobId: job.id,
        },
      );

      await processUploadDlq(job.data.uploadId);
    },
  );
}
