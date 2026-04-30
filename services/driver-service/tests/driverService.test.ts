import { DriverService } from "../src/driverServices";

import { ServiceError } from "@shared/types";
import { testDriver, testUpdateProfileRequest } from "./setup";
import { emitDriverBankVerificationRequested } from "../src/kafka/producer";
import { driver, driverStats } from "../db/schema";
const mockedEmitDriverBankVerificationRequested =
  emitDriverBankVerificationRequested as jest.MockedFunction<
    typeof emitDriverBankVerificationRequested
  >;

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

  beforeEach(() => {
    jest.clearAllMocks();

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
      bankCode: "058",
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
        bankCode: "   058   ",
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
          country: "Nigeria",
          state: "Lagos State",
          city: "Lagos",
          bankName: "GTBank",
          bankCode: "058",
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

    it("marks changed bank details as pending and publishes a verification request", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      const mockSet = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([
        {
          ...testDriver,
          bankCode: "033",
          bankName: "UBA",
          bankVerificationStatus: "pending",
          bankVerificationFailureReason: null,
          bankVerificationRequestedAt: new Date(),
          bankVerifiedAt: null,
        },
      ]);

      (global.mockDrizzle.update as jest.Mock).mockReturnValue({
        set: mockSet,
        where: mockWhere,
        returning: mockReturning,
      });

      const result = await driverService.updateDriver(userId, {
        bankName: "UBA",
        bankCode: "033",
        accountNumber: testDriver.accountNumber,
        accountName: testDriver.accountName,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          bankVerificationStatus: "pending",
          bankVerificationFailureReason: null,
          bankVerifiedAt: null,
        }),
      );
      expect(mockedEmitDriverBankVerificationRequested).toHaveBeenCalledWith({
        driverId: testDriver.id,
        bankName: "UBA",
        bankCode: "033",
        accountNumber: testDriver.accountNumber,
        accountName: testDriver.accountName,
        currency: testDriver.currency,
      });
      expect(result.bankVerificationStatus).toBe("pending");
    });
  });

  describe("getProfileById", () => {
    const driverId = "test-driver-id";
    it("should get driver by id successfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      const result = await driverService.getProfileById(driverId);
      expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });

      expect(result).toEqual(testDriver);
    });

    it("should return null if driver does not exist", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await driverService.getProfileById(driverId);
      expect(result).toBeNull();
    });
  });

  describe("getPublicProfileById", () => {
    const driverId = "test-driver-id";
    it("should get public profile successfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      const result = await driverService.getPublicProfileById(driverId);

      expect(result).toEqual({
        id: testDriver.id,
        firstName: testDriver.firstName,
        lastName: testDriver.lastName,
        phone: testDriver.phone,
        profile_pic: testDriver.profile_pic,
        country: testDriver.country,
        state: testDriver.state,
      });
    });

    it("should return null if driver does not exist", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await driverService.getProfileById(driverId);
      expect(result).toBeNull();
    });
  });

  describe("deleteDriver", () => {
    const userId = "test-user-id";
    it("should delete driver successfully", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(testDriver);

      const mockDeleteWhere = jest.fn().mockResolvedValue({});
      (global.mockDrizzle.delete as jest.Mock).mockReturnValue({
        where: mockDeleteWhere,
      });

      await driverService.deleteDriver(userId);

      expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
      expect(global.mockDrizzle.transaction).toHaveBeenCalledTimes(1);
      expect(global.mockDrizzle.delete).toHaveBeenNthCalledWith(1, driverStats);
      expect(global.mockDrizzle.delete).toHaveBeenNthCalledWith(2, driver);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
    });

    it("should throw error if driver does not exist", async () => {
      (
        global.mockDrizzle.query.driver.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expectServiceError(
        () => driverService.deleteDriver(userId),
        "Driver not found",
        404,
      );

      expect(global.mockDrizzle.delete).not.toHaveBeenCalled();
    });
  });

  describe("getDriverStats", () => {
    const driverId = "test-driver-id";
    const testStats = {
      id: "test-stats-id",
      driverId: driverId,
      totalEarnings: 1000,
      pendingPayments: 200,
      totalPassengers: 50,
      activeRoutes: 5,
      createdAt: new Date("2025-07-01T00:00:00Z"),
      updatedAt: new Date("2025-07-01T00:00:00Z"),
    };

    it("should get driver stats successfully", async () => {
      (
        global.mockDrizzle.query.driverStats?.findFirst as jest.Mock
      ).mockResolvedValue(testStats);

      const result = await driverService.getDriverStats(driverId);
      expect(
        global.mockDrizzle.query.driverStats?.findFirst,
      ).toHaveBeenCalledWith({
        where: expect.anything(),
      });

      expect(result).toEqual(testStats);
    });

    it("should throw error if stats not found", async () => {
      (
        global.mockDrizzle.query.driverStats?.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expectServiceError(
        () => driverService.getDriverStats(driverId),
        "Driver stats not found",
        404,
      );
    });
  });
});
