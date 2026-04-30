import { createHash } from "node:crypto";
// Mock db BEFORE any imports
jest.mock("../db/db", () => {
  const mockDrizzleClient = {
    query: {
      users: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      otp: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      passwordResetTokens: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockReturnThis(),
        })),
      })),
    })),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    }),
    transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockDrizzleClient);
    }),
  };
  global.mockDrizzle = mockDrizzleClient;
  return { db: mockDrizzleClient };
});

jest.mock("../src/kafka/outbox", () => ({
  enqueueNotificationEmail: jest.fn().mockResolvedValue(undefined),
  enqueueUserIdentityUpserted: jest.fn().mockResolvedValue(undefined),
  enqueueUserAccountDeleted: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("bcryptjs", () => {
  return {
    __esModule: true,
    default: {
      hash: jest.fn(),
      compare: jest.fn(),
    },
    hash: jest.fn(), // Include both for safety
    compare: jest.fn(),
  };
});

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));

jest.mock("uuid", () => ({
  v4: jest.fn(),
}));

// import mocked modules
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { resetAllMocks, testJwtPayload, testUser } from "./setup";
import { users } from "../db/schema";
import { AuthService } from "../src/authService";
import {
  enqueueNotificationEmail,
  enqueueUserAccountDeleted,
  enqueueUserIdentityUpserted,
} from "../src/kafka/outbox";

const mockedUuidv4 = uuidv4 as jest.Mock;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedEnqueueNotificationEmail =
  enqueueNotificationEmail as jest.MockedFunction<typeof enqueueNotificationEmail>;
const mockedEnqueueUserAccountDeleted =
  enqueueUserAccountDeleted as jest.MockedFunction<
    typeof enqueueUserAccountDeleted
  >;
const mockedEnqueueUserIdentityUpserted =
  enqueueUserIdentityUpserted as jest.MockedFunction<
    typeof enqueueUserIdentityUpserted
  >;

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    resetAllMocks();
    authService = new AuthService();

    // setup default mock implementations
    mockedUuidv4.mockReturnValue("test-uuid");

    // Casting to any or jest.Mock ensures TS sees the mock methods
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("test-jwt-token");
    (jwt.verify as jest.Mock).mockReturnValue(testJwtPayload);
  });

  describe("constructor", () => {
    it("should initialize with environment variables", () => {
      expect(authService).toBeInstanceOf(AuthService);
    });

    it("should throw an error if JWT_SECRET is not configured", () => {
      delete process.env.JWT_SECRET;
      expect(() => new AuthService()).toThrow(
        "JWT secrets are not defined in the envirnoment variable",
      );
      process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only"; // Reset for other tests
    });

    it("should throw an error if JWT_REFRESH_SECRET is not configured", () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => new AuthService()).toThrow(
        "JWT secrets are not defined in the envirnoment variable",
      );
      process.env.JWT_REFRESH_SECRET =
        "test-jwt-refresh-secret-key-for-testing-only";
    });
  });

  describe("register", () => {
    const email = "sigmmma@user.com";
    const password = "testpassworD123";
    const firstName = "John";
    const lastName = "Doe";
    // const phone = "1234567890";
    const dateOfBirth = new Date("1990-01-01");
    const referal = "";

    it("should successfully register a new user", async () => {
      // 1. Setup Drizzle Mocks
      (global.mockDrizzle.query.users.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      // We store these in variables so we can check them in Assertions (step 2)
      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([testUser]);

      global.mockDrizzle.insert.mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

    const result = await authService.register(
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
    );

      // 2. Assertions
      // Check if it checked for existing email
      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      // Check if it hashed the password
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 4);
      // Check if it inserted the user
      expect(global.mockDrizzle.insert).toHaveBeenCalledWith(users);

      // NOW we check the mockValues variable we actually used
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          password: "hashed-password",
          firstName,
          lastName,
          dateOfBirth,
          referal,
        }),
      );

      expect(result).toEqual({
        user: testUser,
        accessToken: "test-jwt-token",
        refreshToken: "test-jwt-token",
      });
    });

    it("should throw a 409 if user already exists", async () => {
      // Mock that a user WAS found
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      await expect(
        authService.register(
          email,
          password,
          firstName,
          lastName,
          dateOfBirth,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "User Already Exists",
      });
      expect(global.mockDrizzle.insert).not.toHaveBeenCalled();
    });

    it("should handle database errors during creation", async () => {
      // 1. Setup: User doesn't exist yet
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      // 2. Setup: Mock the insert chain to fail at the end (.returning())
      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockRejectedValue(new Error("DB Error"));

      global.mockDrizzle.insert.mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      // 3. Act & Assert: Verify the service passes the error up
      await expect(
        authService.register(
          email,
          password,
          firstName,
          lastName,
          // phone,
          dateOfBirth,
        ),
      ).rejects.toThrow("DB Error");

      // Verify the attempt was made
      expect(global.mockDrizzle.insert).toHaveBeenCalledWith(users);
    });
  });
  describe("verifyOtp", () => {
    const email = "sigmmma@user.com";
    const otp = "123456";

    it("should successfully verify OTP and return tokens", async () => {
      // 1. Setup: User exists
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);
      global.mockDrizzle.query.otp.findFirst.mockResolvedValue({
        email,
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // 2. Setup: OTP exists and matches
      const mockReturning = jest.fn().mockResolvedValue([testUser]);
      const mockWhere = jest.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
      global.mockDrizzle.update.mockReturnValue({ set: mockSet });

      // 3. Setup: Mock the Delete Chain properly
      const mockDeleteReturning = jest.fn().mockResolvedValue([]);
      const mockDeleteWhere = jest
        .fn()
        .mockReturnValue({ returning: mockDeleteReturning });
      global.mockDrizzle.delete.mockReturnValue({ where: mockDeleteWhere });

      // 4. Act
      const result = await authService.verifyOtp(email, otp);

      // 5. Assertions
      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(global.mockDrizzle.query.otp.findFirst).toHaveBeenCalled();

      // Verify Update: update(users).set({ emailVerified: true })
      expect(global.mockDrizzle.update).toHaveBeenCalledWith(users);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
      );

      // Verify Delete
      expect(global.mockDrizzle.delete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();

      expect(result).toEqual({
        user: testUser,
        tokens: {
          accessToken: "test-jwt-token",
          refreshToken: "test-jwt-token",
        },
      });
    });

    it("should throw 404 if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.verifyOtp(email, otp)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });

    it("should throw 401 if OTP not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);
      global.mockDrizzle.query.otp.findFirst.mockResolvedValue(null);

      await expect(authService.verifyOtp(email, otp)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired OTP",
      });
    });

    it("should throw 401 if OTP does not match", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);
      const storedOtp = {
        email,
        otp: "wrong-otp",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      global.mockDrizzle.query.otp.findFirst.mockResolvedValue(storedOtp);

      await expect(authService.verifyOtp(email, otp)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired OTP",
      });
    });

    it("should throw 401 if OTP is expired", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);
      const storedOtp = {
        email,
        otp,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired
      };
      global.mockDrizzle.query.otp.findFirst.mockResolvedValue(storedOtp);

      await expect(authService.verifyOtp(email, otp)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired OTP",
      });
    });
  });

  describe("login", () => {
    const email = "testuser123@domain.com";
    const password = "testPassword123";

    it("should login successfully and return tokens", async () => {
      const userWithPassword = {
        ...testUser,
        password: "hashed-password",
        emailVerified: true,
      };
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(
        userWithPassword,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(email, password);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(password, "hashed-password");
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("should throw 401 if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.login(email, password)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid Email or Password",
      });
    });

    it("should throw 401 if password is invalid", async () => {
      const userWithPassword = { ...testUser, password: "hashed-password" };
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(
        userWithPassword,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(email, password)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid Email or Password",
      });
    });

    it("should throw 401 if user signed up with Google (no password)", async () => {
      const userWithoutPassword = { ...testUser, password: null };
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(
        userWithoutPassword,
      );

      await expect(authService.login(email, password)).rejects.toMatchObject({
        statusCode: 401,
        message:
          "This account was created with Google. Please sign in with Google.",
      });
    });

    it("should throw 403 if email is not verified", async () => {
      const userWithPassword = {
        ...testUser,
        password: "hashed-password",
        emailVerified: false,
      };
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(
        userWithPassword,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.login(email, password)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("forgotPassword", () => {
    const email = "testuser123@domain.com";

    it("should send reset password email successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const result = await authService.forgotPassword(email);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(global.mockDrizzle.insert).toHaveBeenCalled();
      expect(mockedEnqueueNotificationEmail).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should return successfully if user is not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.forgotPassword(email)).resolves.toBeUndefined();
      expect(mockedEnqueueNotificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    const token = "valid-reset-token";
    const password = "newPassword123";
    const tokenHash = createHash("sha256").update(token).digest("hex");

    it("should reset password successfully", async () => {
      global.mockDrizzle.query.passwordResetTokens.findFirst.mockResolvedValue({
        id: "reset-token-1",
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const result = await authService.resetPassword(token, password);

      expect(global.mockDrizzle.query.passwordResetTokens.findFirst).toHaveBeenCalled();
      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
      expect(global.mockDrizzle.update).toHaveBeenCalledWith(users);
      expect(global.mockDrizzle.update.mock.results[0]?.value.set).toHaveBeenCalledWith(
        expect.objectContaining({
          password: "hashed-password",
          sessionInvalidBefore: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toHaveProperty("user");
    });

    it("should throw 401 if token is invalid", async () => {
      global.mockDrizzle.query.passwordResetTokens.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword(token, password),
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired token",
      });
    });

    it("should throw 401 if token is expired", async () => {
      global.mockDrizzle.query.passwordResetTokens.findFirst.mockResolvedValue({
        id: "reset-token-1",
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.resetPassword(token, password),
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired token",
      });
    });

    it("should throw 404 if user not found", async () => {
      global.mockDrizzle.query.passwordResetTokens.findFirst.mockResolvedValue({
        id: "reset-token-1",
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword(token, password),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("getUserById", () => {
    const userId = "test-user-id";

    it("should get user by id successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const result = await authService.getUserById(userId);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("email");
      expect(result).toHaveProperty("hasPassword");
    });

    it("should throw 404 if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.getUserById(userId)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("getUserSessionState", () => {
    const userId = "test-user-id";

    it("returns the session invalidation timestamp for internal session checks", async () => {
      const sessionInvalidBefore = new Date("2026-04-24T09:00:00.000Z");
      global.mockDrizzle.query.users.findFirst.mockResolvedValue({
        id: userId,
        sessionInvalidBefore,
      });

      const result = await authService.getUserSessionState(userId);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(result).toEqual({ sessionInvalidBefore });
    });

    it("throws 404 when the user session state is requested for a missing user", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.getUserSessionState(userId)).rejects.toMatchObject(
        {
          statusCode: 404,
          message: "User not found",
        },
      );
    });
  });

  describe("updateProfile", () => {
    const userId = "test-user-id";
    const updateData = {
      firstName: "UpdatedName",
      lastName: "UpdatedLastName",
    };

    it("should update profile successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnValue({
        returning: jest
          .fn()
          .mockResolvedValue([{ ...testUser, ...updateData }]),
      });
      global.mockDrizzle.update.mockReturnValue({
        set: mockSet,
        where: mockWhere,
      });

      const result = await authService.updateProfile(userId, updateData);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(global.mockDrizzle.update).toHaveBeenCalled();
      expect(mockedEnqueueUserIdentityUpserted).toHaveBeenCalled();
      expect(result).toHaveProperty("firstName", "UpdatedName");
    });

    it("should throw 404 if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(
        authService.updateProfile(userId, updateData),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("resendOtp", () => {
    const email = "testuser123@domain.com";

    it("should resend OTP successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);
      global.mockDrizzle.query.otp.findFirst.mockResolvedValue(null);

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest
        .fn()
        .mockResolvedValue([{ ...testUser, otp: "123456" }]);
      global.mockDrizzle.insert.mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const result = await authService.resendOtp(email);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(mockedEnqueueNotificationEmail).toHaveBeenCalled();
      expect(result).toBe("otp sent successfully");
    });

    it("should throw 404 if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      await expect(authService.resendOtp(email)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("deleteUser", () => {
    const userId = "test-user-id";

    it("should delete user successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const mockDeleteWhere = jest.fn().mockResolvedValue({});
      global.mockDrizzle.delete.mockReturnValue({ where: mockDeleteWhere });

      await authService.deleteUser(userId);

      expect(global.mockDrizzle.delete).toHaveBeenCalled();
      expect(mockedEnqueueUserAccountDeleted).toHaveBeenCalled();
    });
  });

  describe("getUserByEmail", () => {
    const email = "testuser123@domain.com";

    it("should get user by email successfully", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(testUser);

      const result = await authService.getUserByEmail(email);

      expect(global.mockDrizzle.query.users.findFirst).toHaveBeenCalled();
      expect(result).toEqual(testUser);
    });

    it("should return null if user not found", async () => {
      global.mockDrizzle.query.users.findFirst.mockResolvedValue(null);

      const result = await authService.getUserByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe("createTokens", () => {
    it("should create tokens successfully", async () => {
      const result = authService.createTokens(
        "user-id",
        "test@example.com",
        true,
      );

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });
  });
});
