import { db } from "../db/db";
import { User, users, Otp, otp, userProviders } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
// import { createServiceError } from "@shared/utils";
import { createServiceError } from "../../../shared/utils";

import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import {
  AuthTokens,
  JWTPayload,
  ServiceError,
  UpdateProfileRequest,
  UpdateUserRequest,
} from "@shared/types";
import { Producer } from "kafkajs";

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly bcryptRounds: number;

  private readonly producer: Producer;

  constructor(producer: Producer) {
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "15m"!;
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d"!;
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10)!;

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error(
        "JWT secrets are not defined in the envirnoment variable",
      );
    }

    this.producer = producer;
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    // phone: string,
    dateOfBirth: Date,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    //check if user exists
    const userExists = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (userExists) {
      throw createServiceError("User Already Exists", 409);
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

    //create the new user in the database
    const data = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      // phone,
      dateOfBirth,
      referal: "",
    };
    const [createdUser] = await db.insert(users).values(data).returning();

    const tokens = this.generateTokens(
      createdUser.id,
      createdUser.email,
      createdUser.emailVerified,
    );

    const storedOtp = this.generateOtp();

    //store otp in the database
    await db.insert(otp).values({
      email: createdUser.email,
      otp: storedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    //send mail using kafka instead(don't block registration if email fails)
    try {
      await this.producer.send({
        topic: "user-created",
        messages: [
          {
            value: JSON.stringify({
              email: createdUser.email,
              subject: "Verify your email",
              text: `Verify OTP,  This is your Otp ${storedOtp}`,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(error.message);
      console.error(
        "Failed to send verification email, please request another otp to complete verification",
      );
    }

    return { user: createdUser, ...tokens };
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

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        this.jwtRefreshSecret,
      ) as JWTPayload;

      if (!decoded) {
        throw createServiceError(
          "Invalid or expired refresh token, please login",
          403,
        );
      }

      const tokens = await this.generateTokens(
        decoded.userId,
        decoded.email,
        decoded.emailVerified,
      );

      return tokens;
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;

      //check if user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });

      if (!user) {
        throw createServiceError("User not found", 404);
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createServiceError("Invalid Token", 401);
      }
      throw createServiceError("Token validation failed", 500, error);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5001/v1/auth";
    const resetLink = `${frontendUrl}/reset-password/${this.generateTokens(user.id, user.email, user.emailVerified).accessToken}`;

    //send mail using kafka instead(don't block registration if email fails)
    try {
      await this.producer.send({
        topic: "forgot-password",
        messages: [
          {
            value: JSON.stringify({
              email: user.email,
              subject: "Reset Password",
              text: `
    <p>Click on the link below to reset your password</p>
    <a href="${resetLink}">Reset Password</a>
    `,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(error.message);
      console.error(
        "Failed to send verification email, please request another otp to complete verification",
      );
    }
  }

  async resetPassword(token: string, password: string) {
    const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
    if (!decoded) {
      throw createServiceError("Invalid or expired token", 401);
    }
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id));

    return { user };
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
        // phone: true,
        dateOfBirth: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        password: true,
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

  async updateProfile(userId: string, data: UpdateUserRequest) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      throw createServiceError("User not found", 404);
    }
    const updatedUser = await db
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

    if (existingOtp) {
      await db
        .update(otp)
        .set({
          otp: storedOtp,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(otp.email, user.email));
    } else {
      await db.insert(otp).values({
        email: user.email,
        otp: storedOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    }
    //send email using kafka
    try {
      await this.producer.send({
        topic: "user-created",
        messages: [
          {
            value: JSON.stringify({
              email: user.email,
              subject: "Verify your email",
              text: `Verify OTP,  This is your Otp ${storedOtp}`,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(error.message);
      console.error(
        "Failed to send verification email, please request another otp to complete verification",
      );
    }
    return "otp sent successfully";
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));

    //delete driver records with kafka
    try {
      await this.producer.send({
        topic: "user-deleted",
        messages: [
          {
            value: JSON.stringify({
              userId: userId,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(error.message);
      console.error("Failed to delete driver records");
    }
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

    return providers.map((p) => p.provider);
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
