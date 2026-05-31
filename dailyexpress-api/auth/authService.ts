import { createHash, randomBytes } from "node:crypto";
import { db } from "../db/connection";
import {
  driver,
  driverStats,
  users,
  otp,
  passwordResetTokens,
  userProviders,
} from "../db/index";
import type { User } from "../db/index";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createServiceError } from "@shared/utils";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { UpdateUserRequest } from "@shared/types";
import { FRONTEND_URL } from "./authUrls";
import { jobService } from "../workers/jobService";
import {
  renderEmail,
  getEmailSubject,
  isSupportedTemplate,
} from "@repo/email";

const OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_TOKEN_BYTES = 32;

async function renderVerifyOtpEmail(storedOtp: string) {
  const brandName = process.env.EMAIL_BRAND_NAME || "Daily Express";
  const supportEmail =
    process.env.SUPPORT_EMAIL || "support@dailyexpress.com";

  const props = {
    otp: storedOtp,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
    brandName,
    supportEmail,
    frontendUrl: FRONTEND_URL,
  };

  if (isSupportedTemplate("VerifyOtpEmail")) {
    const propsJson = JSON.stringify(props);
    return {
      subject: getEmailSubject("VerifyOtpEmail", propsJson),
      html: await renderEmail("VerifyOtpEmail", propsJson),
    };
  }

  return {
    subject: "Verify your email",
    html: `Your OTP is: ${storedOtp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
  };
}

async function renderResetPasswordEmail(resetLink: string) {
  const brandName = process.env.EMAIL_BRAND_NAME || "Daily Express";
  const supportEmail = process.env.SUPPORT_EMAIL || "support@dailyexpress.com";

  const props = {
    resetUrl: resetLink,
    brandName,
    supportEmail,
    frontendUrl: FRONTEND_URL,
  };

  if (isSupportedTemplate("ResetPasswordEmail")) {
    const propsJson = JSON.stringify(props);
    return {
      subject: getEmailSubject("ResetPasswordEmail", propsJson),
      html: await renderEmail("ResetPasswordEmail", propsJson),
    };
  }

  return {
    subject: "Reset Password",
    html: `Click here to reset your password: ${resetLink}`,
  };
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly bcryptRounds: number;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN!;
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN!;
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS!, 10)!;

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error(
        "JWT secrets are not defined in the envirnoment variable",
      );
    }
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth: Date,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    //check if user exists
    const userExists = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (userExists) {
      throw createServiceError("User Already Exists", 409);
    }

    const storedOtp = this.generateOtp();
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
    const emailJob = await renderVerifyOtpEmail(storedOtp);

    const result = await db.transaction(async (tx) => {
      const data = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        dateOfBirth,
        referal: "",
      };

      const [createdUser] = await tx.insert(users).values(data).returning();

      await tx.insert(otp).values({
        email: createdUser.email,
        otp: storedOtp,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      });

      await jobService.enqueueEmail(tx, "email.auth.verify_otp", {
        to: createdUser.email,
        subject: emailJob.subject,
        html: emailJob.html,
      });

      return createdUser;
    });

    return {
      user: result,
      ...this.generateTokens(result.id, result.email, result.emailVerified),
    };
  }

  async verifyOtp(email: string, userOtp: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const storedOtp = await db.query.otp.findFirst({
      where: eq(otp.email, email),
    });
    if (!storedOtp) {
      throw createServiceError("Invalid or expired OTP", 401);
    }

    if (storedOtp.otp !== userOtp) {
      throw createServiceError("Invalid or expired OTP", 401);
    }

    if (storedOtp.expiresAt < new Date()) {
      throw createServiceError("Invalid or expired OTP", 401);
    }

    const updatedUser = await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user.id))
      .returning();
    await db.delete(otp).where(eq(otp.email, email));

    return {
      user: updatedUser[0],
      tokens: this.generateTokens(
        updatedUser[0].id,
        updatedUser[0].email,
        true,
      ),
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    emailVerified: boolean,
  ): { accessToken: string; refreshToken: string } {
    const payload = { userId, email, emailVerified };

    const accessTokenOptions: SignOptions = {
      expiresIn: this.jwtExpiresIn as any,
    };

    const accessToken = jwt.sign(
      payload,
      this.jwtSecret as Secret,
      accessTokenOptions,
    ) as string;

    const refreshTokenOptions: SignOptions = {
      expiresIn: this.jwtRefreshExpiresIn as any,
    };

    const refreshToken = jwt.sign(
      payload,
      this.jwtRefreshSecret as Secret,
      refreshTokenOptions,
    ) as string;

    return { accessToken, refreshToken };
  }

  public createTokens(
    userId: string,
    email: string,
    emailVerified: boolean,
  ): { accessToken: string; refreshToken: string } {
    return this.generateTokens(userId, email, emailVerified);
  }

  private generateOtp() {
    //generate 6 digit otp
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  }

  private hashPasswordResetToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private createPasswordResetToken() {
    const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");

    return {
      rawToken,
      tokenHash: this.hashPasswordResetToken(rawToken),
      expiresAt: new Date(
        Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
      ),
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.createPasswordResetToken();
    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const emailJob = await renderResetPasswordEmail(resetLink);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({
          usedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      await jobService.enqueueEmail(tx, "email.auth.reset_password", {
        to: user.email,
        subject: emailJob.subject,
        html: emailJob.html,
      });
    });
  }

  async resetPassword(token: string, password: string) {
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(
        passwordResetTokens.tokenHash,
        this.hashPasswordResetToken(token),
      ),
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= Date.now()
    ) {
      throw createServiceError("Invalid or expired token", 401);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, resetToken.userId),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

    await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(users)
        .set({
          password: hashedPassword,
          sessionInvalidBefore: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));

      await tx
        .update(passwordResetTokens)
        .set({
          usedAt: now,
          updatedAt: now,
        })
        .where(eq(passwordResetTokens.id, resetToken.id));

      await tx
        .update(passwordResetTokens)
        .set({
          usedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt),
          ),
        );
    });

    return { user };
  }

  async login(email: string, password: string) {
    const userExists = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!userExists) {
      throw createServiceError("Invalid Email or Password", 401);
    }

    // Check if user signed up with Google (no password)
    if (!userExists.password) {
      throw createServiceError(
        "This account was created with Google. Please sign in with Google.",
        401,
      );
    }

    //verify the password
    const isPasswordValid = await bcrypt.compare(password, userExists.password);
    if (!isPasswordValid) {
      throw createServiceError("Invalid Email or Password", 401);
    }

    //check if email is verified
    if (!userExists.emailVerified) {
      throw createServiceError(
        "Please verify your email before logging in. Check your inbox for the verification code or request a new one.",
        403,
      );
    }

    //return token
    return this.generateTokens(
      userExists.id,
      userExists.email,
      userExists.emailVerified,
    );
  }

  async getUserById(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        profilePictureUrl: true,
      },
    });

    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const { password, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      hasPassword: !!password,
    };
  }

  async getUserSessionState(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        sessionInvalidBefore: true,
      },
    });

    if (!user) {
      throw createServiceError("User not found", 404);
    }

    return {
      sessionInvalidBefore: user.sessionInvalidBefore,
    };
  }

  async updateProfile(userId: string, data: UpdateUserRequest) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async resendOtp(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const storedOtp = this.generateOtp();
    const existingOtp = await db.query.otp.findFirst({
      where: eq(otp.email, user.email),
    });
    const emailJob = await renderVerifyOtpEmail(storedOtp);

    await db.transaction(async (tx) => {
      if (existingOtp) {
        await tx
          .update(otp)
          .set({
            otp: storedOtp,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(otp.email, user.email));
      } else {
        await tx.insert(otp).values({
          email: user.email,
          otp: storedOtp,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        });
      }

      await jobService.enqueueEmail(tx, "email.auth.verify_otp", {
        to: user.email,
        subject: emailJob.subject,
        html: emailJob.html,
      });
    });

    return "otp sent successfully";
  }

  async deleteUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const existingDriver = await tx.query.driver.findFirst({
        where: eq(driver.userId, userId),
      });

      if (existingDriver) {
        await tx
          .update(driver)
          .set({
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(driver.id, existingDriver.id));
      }

      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId));
      await tx
        .delete(userProviders)
        .where(eq(userProviders.userId, userId));

      await tx
        .update(users)
        .set({
          firstName: "[deleted]",
          lastName: "[deleted]",
          email: `deleted-${userId}@dailyexpress.com`,
          password: null,
          dateOfBirth: new Date(0),
          profilePictureUrl: null,
          sessionInvalidBefore: new Date(),
          deletedAt: new Date(),
          anonymizedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });
  }

  async getUserByEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return user;
  }

  async getProviders(userId: string) {
    const providers = await db.query.userProviders.findMany({
      where: eq(userProviders.userId, userId),
      columns: {
        provider: true,
      },
    });
    return providers.map((p: typeof providers[number]) => p.provider);
  }

  async disconnectProvider(userId: string, provider: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        password: true,
      },
    });

    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const connectedProviders = await db.query.userProviders.findMany({
      where: eq(userProviders.userId, userId),
    });

    if (!user.password && connectedProviders.length <= 1) {
      throw createServiceError(
        "Cannot disconnect your only login method. Please set a password first.",
        400,
      );
    }

    await db
      .delete(userProviders)
      .where(
        and(
          eq(userProviders.userId, userId),
          eq(userProviders.provider, provider),
        ),
      );
  }

  async setPassword(userId: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }
}
