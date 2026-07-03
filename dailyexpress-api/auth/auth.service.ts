import { createHash, randomBytes, randomInt } from "node:crypto";
import { type EnvConfig } from "../config/index";
import { db } from "../db/connection";
import bcrypt from "bcryptjs";
import { createServiceError } from "@shared/utils";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { UpdateUserRequest } from "@shared/types";
import { FRONTEND_URL } from "./authUrls";
import { jobService } from "../workers/job.service";
import {
  renderEmail,
  getEmailSubject,
  isSupportedTemplate,
} from "@repo/email";
import { AuthRepository } from "./auth.repository";
import { DriverRepository } from "../driver/driver.repository";
import { paymentRepository } from "../payment/payment.repository";
import { getStartOfTodayInRouteTimezone } from "../utils/timezone";
import { isUnder13 } from "./validation";

const OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_TOKEN_BYTES = 32;

async function renderVerifyOtpEmail(storedOtp: string) {
  const brandName = process.env.EMAIL_BRAND_NAME || "Daily Express";
  const supportEmail =
    process.env.SUPPORT_EMAIL || "support@dailyexpress.app";

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
  const supportEmail = process.env.SUPPORT_EMAIL || "support@dailyexpress.app";

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
  private readonly repo: AuthRepository;
  private readonly driverRepo: DriverRepository;

  constructor(config: EnvConfig, repo?: AuthRepository) {
    this.jwtSecret = config.JWT_SECRET;
    this.jwtRefreshSecret = config.JWT_REFRESH_SECRET;
    this.jwtExpiresIn = config.JWT_EXPIRES_IN;
    this.jwtRefreshExpiresIn = config.JWT_REFRESH_EXPIRES_IN;
    this.bcryptRounds = config.BCRYPT_ROUNDS;
    this.repo = repo ?? new AuthRepository();
    this.driverRepo = new DriverRepository();
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth: Date,
  ) {
    const userExists = await this.repo.findUserByEmail(email);
    if (userExists) {
      throw createServiceError("User Already Exists", 409);
    }

    if (isUnder13(dateOfBirth)) {
      throw createServiceError(
        "You must be at least 13 years old to create an account",
        400,
      );
    }

    const storedOtp = this.generateOtp();
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
    const emailJob = await renderVerifyOtpEmail(storedOtp);

    const result = await db.transaction(async (tx) => {
      const createdUser = await this.repo.insertUser(tx, {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        dateOfBirth,
        referral: "",
      });

      await this.repo.insertOtp(tx, {
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
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const storedOtp = await this.repo.findOtpByEmail(email);
    if (!storedOtp || storedOtp.otp !== userOtp || storedOtp.expiresAt < new Date()) {
      throw createServiceError("Invalid or expired OTP", 401);
    }

    const [updatedUser] = await this.repo.updateUserStandalone(user.id, {
      emailVerified: true,
    });
    await this.repo.deleteOtp(email);

    return {
      user: updatedUser,
      tokens: this.generateTokens(updatedUser.id, updatedUser.email, true),
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    emailVerified: boolean,
  ): { accessToken: string; refreshToken: string } {
    const payload = { userId, email, emailVerified };
    const tokenOptions: SignOptions = {
      issuer: "dailyexpress-api",
      audience: "dailyexpress-app",
    };
    const accessToken = jwt.sign(
      payload,
      this.jwtSecret as Secret,
      { ...tokenOptions, expiresIn: this.jwtExpiresIn } as SignOptions,
    ) as string;
    const refreshToken = jwt.sign(
      payload,
      this.jwtRefreshSecret as Secret,
      { ...tokenOptions, expiresIn: this.jwtRefreshExpiresIn } as SignOptions,
    ) as string;
    return { accessToken, refreshToken };
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
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
    const user = await this.repo.findUserByEmail(email);
    if (!user) return;

    const { rawToken, tokenHash, expiresAt } = this.createPasswordResetToken();
    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const emailJob = await renderResetPasswordEmail(resetLink);

    await db.transaction(async (tx) => {
      await this.repo.invalidatePasswordResetTokens(tx, user.id);
      await this.repo.insertPasswordResetToken(tx, {
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
    const resetToken = await this.repo.findPasswordResetTokenByHash(
      this.hashPasswordResetToken(token),
    );

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= Date.now()
    ) {
      throw createServiceError("Invalid or expired token", 401);
    }

    const user = await this.repo.findUserById(resetToken.userId);
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

    await db.transaction(async (tx) => {
      const now = new Date();
      await this.repo.updateUser(tx, user.id, {
        password: hashedPassword,
        sessionInvalidBefore: now,
        updatedAt: now,
      });
      await this.repo.invalidatePasswordResetTokens(tx, user.id);
    });

    return { user };
  }

  async login(email: string, password: string) {
    const userExists = await this.repo.findUserByEmail(email);
    if (!userExists) {
      throw createServiceError("Invalid Email or Password", 401);
    }

    if (!userExists.password) {
      throw createServiceError(
        "This account was created with Google. Please sign in with Google.",
        401,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, userExists.password);
    if (!isPasswordValid) {
      throw createServiceError("Invalid Email or Password", 401);
    }

    if (!userExists.emailVerified) {
      throw createServiceError(
        "Please verify your email before logging in. Check your inbox for the verification code or request a new one.",
        403,
      );
    }

    return this.generateTokens(
      userExists.id,
      userExists.email,
      userExists.emailVerified,
    );
  }

  async getUserById(userId: string) {
    const user = await this.repo.findUserById(userId);
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
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    return { sessionInvalidBefore: user.sessionInvalidBefore };
  }

  async updateProfile(userId: string, data: UpdateUserRequest) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const [updated] = await this.repo.updateUserStandalone(userId, data);
    return updated;
  }

  async resendOtp(email: string) {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const storedOtp = this.generateOtp();
    const existingOtp = await this.repo.findOtpByEmail(user.email);
    const emailJob = await renderVerifyOtpEmail(storedOtp);

    await db.transaction(async (tx) => {
      if (existingOtp) {
        await this.repo.updateOtp(tx, user.email, {
          otp: storedOtp,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
          updatedAt: new Date(),
        });
      } else {
        await this.repo.insertOtp(tx, {
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
    const existingDriver = await this.repo.findDriverByUserId(userId);

    if (existingDriver) {
      const upcomingTrips = await paymentRepository.findSuccessfulPaymentsForDriverUpcomingTrips(
        existingDriver.id,
        getStartOfTodayInRouteTimezone(),
      );
      if (upcomingTrips.length > 0) {
        throw createServiceError(
          "Cannot delete your account. You have upcoming trips with confirmed bookings.",
          400,
        );
      }
    }

    await db.transaction(async (tx) => {
      if (existingDriver) {
        await this.driverRepo.deactivateDriver(tx, existingDriver.id);
      }

      await this.repo.deletePasswordResetTokensByUser(tx, userId);
      await this.repo.deleteUserProvidersByUser(tx, userId);

      await this.repo.updateUser(tx, userId, {
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
      });
    });
  }

  async getUserByEmail(email: string) {
    return this.repo.findUserByEmail(email);
  }

  async getProviders(userId: string) {
    const providers = await this.repo.findUserProviders(userId);
    return providers.map((p) => p.provider);
  }

  async disconnectProvider(userId: string, provider: string) {
    const userLoginSummary = await this.repo.findUserLoginSummary(userId);

    if (!userLoginSummary) {
      throw createServiceError("User not found", 404);
    }

    if (!userLoginSummary.password && userLoginSummary.providerCount <= 1) {
      throw createServiceError(
        "Cannot disconnect your only login method. Please set a password first.",
        400,
      );
    }

    await this.repo.deleteUserProvider(userId, provider);
  }

  async invalidateSessions(userId: string): Promise<void> {
    await this.repo.updateUserStandalone(userId, {
      sessionInvalidBefore: new Date(),
    });
  }

  async setPassword(userId: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
    await this.repo.updateUserStandalone(userId, { password: hashedPassword });
  }
}
