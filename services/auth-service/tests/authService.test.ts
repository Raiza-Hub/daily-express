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
  };
  global.mockDrizzle = mockDrizzleClient;
  return { db: mockDrizzleClient };
});

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

// jest.mock("jsonwebtoken", () => ({
//   sign: jest.fn(),
//   verify: jest.fn(),
// }));

jest.mock("uuid", () => ({
  v4: jest.fn(),
}));
// jest.mock("bcryptjs", () => ({
//   hash: jest.fn(),
//   compare: jest.fn(),
// }));

// import mocked modules
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { resetAllMocks, testJwtPayload, testUser } from "./setup";
import { users } from "../db/schema";
import { AuthService } from "../src/authService";
// import {
//   resetAllMocks,
//   testJwtPayload,
//   testRefreshToken,
//   testUser,
// } from "./setup";
// import { ServiceError } from "../../../shared/types";

// 2. These casts will now point to the functions defined above
const mockedUuidv4 = uuidv4 as jest.Mock;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

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
    const phone = "1234567890";
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
        phone,
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
          phone,
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
          phone,
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
          phone,
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
      const mockWhere = jest.fn().mockReturnThis();
      const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
      global.mockDrizzle.update.mockReturnValue({ set: mockSet });
      // 3. Setup: Mock the Delete Chain properly
      const mockDeleteWhere = jest.fn().mockReturnThis();
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
});
