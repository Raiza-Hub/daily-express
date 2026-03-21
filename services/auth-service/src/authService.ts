import { db } from "../db/db";
import { User, users, Otp, otp } from "../db/schema";
import { eq } from "drizzle-orm";
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

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly bcryptRounds: number;

  constructor() {
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
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string,
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
      phone,
      dateOfBirth,
    };
    const [createdUser] = await db.insert(users).values(data).returning();

    const tokens = this.generateTokens(
      createdUser.id,
      createdUser.email,
      createdUser.emailVerified,
    );

    const storedOtp = this.generateOtp();

    //send mail
    await this.sendEmail(
      createdUser.email,
      "Verify your email",
      `Verify OTP,  This is your Otp ${storedOtp}`,
    );

    //store otp in the database
    await db.insert(otp).values({
      email: createdUser.email,
      otp: storedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

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
      updatedUser,
      tokens: this.generateTokens(user.id, user.email, user.emailVerified),
    };
  }

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      //verify refresh Token
      const decoded = jwt.verify(
        refreshToken,
        this.jwtRefreshSecret,
      ) as JWTPayload;

      //check if the refresh token exists
      if (!decoded) {
        throw createServiceError(
          "Invalid or expored refresh token, please login",
          401,
        );
      }

      //generate new token
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

    //using jwt aling with an http link that redirect directly to the forgot password route
    const message = `
    <p>Click on the link below to reset your password</p>
    <a href="http://localhost:3001/v1/auth/reset-password/${this.generateTokens(user.id, user.email, user.emailVerified).accessToken}">Reset Password</a>
    `;

    //send mail
    await this.sendEmail(user.email, "Reset Password", message);
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
  private async sendEmail(to: string, subject: string, html: string) {
    await fetch("http://localhost:3004/v1/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        html,
      }),
    });
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

    //verify the password

    const isPasswordValid = await bcrypt.compare(password, userExists.password);
    if (!isPasswordValid) {
      throw createServiceError("Invalid Email or Password", 401);
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
        phone: true,
        dateOfBirth: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw createServiceError(" User not found", 404);
    }
    return user;
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
    await this.sendEmail(
      user.email,
      "Verify your email",
      `Verify OTP,  This is your Otp ${storedOtp}`,
    );
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
    return "otp sent successfully";
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async getUserByEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return user;
  }
}
