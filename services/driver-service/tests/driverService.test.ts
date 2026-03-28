import { DriverService } from "../src/driverServices";

//Mock external dependencies
// jest.mock("../src/authClient");
// 5. Mock external dependencies (with mandatory factory function for Bun)
jest.mock("../src/authClient", () => {
  return {
    AuthClient: jest.fn().mockImplementation(() => ({
      verifyToken: jest.fn(),
      getUser: jest.fn(),
    })),
  };
});

//Import mocked modules
import { AuthClient } from "@/authClient";
import { mocked } from "jest-mock";
import { ServiceError } from "@shared/types";
import { testDriver, testUpdateProfileRequest } from "./setup";

const MockedAuthClient = AuthClient as jest.Mocked<typeof AuthClient>;

//Helper function to test Service Error
async function expectServiceError(
  asyncFn: () => Promise<any>,
  expectedMessage: string,
  expectedStatusCode: number,
) {
  try {
    await asyncFn();
    fail("Expected function to throw ServiceError");
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.message).toBe(expectedMessage);
    expect(error.statusCode).toBe(expectedStatusCode);
  }
}

describe("DriverService", () => {
  let driverService: DriverService;
  let mockAuthClient: jest.Mocked<AuthClient>;

  beforeEach(() => {
    driverService = new DriverService();
    jest.clearAllMocks();

    //create mock Auth client response
    mockAuthClient = {
      verifyToken: jest.fn(),
    } as any;

    const MockedAuthClient = mocked(AuthClient);
    MockedAuthClient.mockImplementation(() => mockAuthClient as any);

    driverService = new DriverService();
  });

  describe("createDriver", () => {
    const userId = "test-user-id";
    const driverData = {
      firstName: "John",
      lastName: "Doe",
      email: "testdriver123@domain.com",
      phone: "+2348090904909",
      gender: "male" as "male" | "female",
      country: "Nigeria",
      state: "Lagos State",
      city: "Lagos",
      bankName: "GTBank",
      accountNumber: "1234567890",
      accountName: "Test User",
      profile_pic: "https://example.com/test-driver.jpg",
    };
    it("should create a driver succesfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);
      global.mockDrizzle.insert.mockResolvedValue(testDriver);

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([testDriver]);

      (global.mockDrizzle.insert as jest.Mock).mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const result = await driverService.createDriver(userId, driverData);

      expect(result).toEqual(testDriver);
      // expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
      //   where: {
      //     userId: "test-user-id",
      //   },
      // });
      // Check that insert was called with the driver table
      expect(global.mockDrizzle.insert).toHaveBeenCalledWith(expect.anything());

      // Check that values was called with the actual driver data
      const mockInsertChain = global.mockDrizzle.insert();
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user-id",
          email: "testdriver123@domain.com",
        }),
      );
      // expect(global.mockDrizzle.insert).toHaveBeenCalledWith({
      //   values: {
      //     userId: "test-user-id",
      //     ...driverData,
      //   },
      // });

      expect(global.mockDrizzle.insert).toHaveBeenCalledWith(
        expect.anything(), // This ignores the complex Drizzle table object
      );

      expect(result).toEqual(testDriver);
    });

    it("should throw error if driver already exists", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      await expectServiceError(
        () => driverService.createDriver(userId, driverData),
        "Driver profile already exists",
        400,
      );

      expect(global.mockDrizzle.insert).not.toHaveBeenCalled();
    });

    it("should sanitize before creating driver", async () => {
      const driverData = {
        userId: "test-user-id",
        firstName: "   John   ",
        lastName: "   Doe   ",
        email: "   testdriver123@domain.com   ",
        phone: "   +2348090904909   ",
        gender: "   male   " as "male" | "female",
        country: "   Nigeria   ",
        state: "   Lagos State   ",
        city: "   Lagos   ",
        bankName: "   GTBank   ",
        accountNumber: "   1234567890   ",
        accountName: "   Test User   ",
        profile_pic: "   https://example.com/test-driver.jpg   ",
      };
      global.mockDrizzle.query.driver.findFirst.mockResolvedValue(null);
      global.mockDrizzle.insert.mockResolvedValue(testDriver);

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([testDriver]);

      (global.mockDrizzle.insert as jest.Mock).mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const result = await driverService.createDriver(userId, driverData);

      expect(global.mockDrizzle.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user-id",
          email: "testdriver123@domain.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+2348090904909",
          gender: "male",
          country: "Nigeria",
          state: "Lagos State",
          city: "Lagos",
          bankName: "GTBank",
          accountNumber: "1234567890",
          accountName: "Test User",
          profile_pic: "https://example.com/test-driver.jpg",
        }),
      );

      expect(result).toEqual(testDriver);
    });
  });

  describe("getProfile", () => {
    const userId = "test-user-id";
    it("should get an existing driver profile successfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      const result = await driverService.getProfile(userId);
      expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });

      expect(result).toEqual(testDriver);
    });

    it("should throw error if driver does not exist", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expectServiceError(
        () => driverService.getProfile(userId),
        "Driver not found",
        404,
      );
    });
  });
  describe("updateProfile", () => {
    const userId = "test-user-id";
    it("should update an existing driver profile successfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);
      global.mockDrizzle.update.mockResolvedValue({
        ...testDriver,
        ...testUpdateProfileRequest,
      });
    });
    it("should create a profile if it does not exist", async () => {
      // findFirst returns null → updateDriver falls through to createDriver
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);

      // Set up the insert chain so .values().returning() doesn't crash
      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([testDriver]);
      (global.mockDrizzle.insert as jest.Mock).mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const result = await driverService.updateDriver(
        userId,
        testUpdateProfileRequest,
      );

      // findFirst is called with a Drizzle eq() expression — use expect.anything()
      expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });

      // insert() receives the Drizzle table schema object, not the data
      expect(global.mockDrizzle.insert).toHaveBeenCalledWith(expect.anything());

      // values() receives the actual sanitized data + userId
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          email: testUpdateProfileRequest.email,
        }),
      );

      expect(result).toEqual(testDriver);
    });
  });
});
