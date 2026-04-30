import { DriverService } from "../src/driverServices";
import {
  emitDriverIdentityCreated,
  emitDriverIdentityDeleted,
  emitDriverIdentityUpdated,
} from "../src/kafka/producer";
import { testDriver } from "./setup";

const mockedEmitDriverIdentityCreated =
  emitDriverIdentityCreated as jest.MockedFunction<
    typeof emitDriverIdentityCreated
  >;
const mockedEmitDriverIdentityUpdated =
  emitDriverIdentityUpdated as jest.MockedFunction<
    typeof emitDriverIdentityUpdated
  >;
const mockedEmitDriverIdentityDeleted =
  emitDriverIdentityDeleted as jest.MockedFunction<
    typeof emitDriverIdentityDeleted
  >;

describe("DriverService identity events", () => {
  let driverService: DriverService;

  beforeEach(() => {
    jest.clearAllMocks();
    driverService = new DriverService();
  });

  it("publishes a driver.identity.created event when a driver is created", async () => {
    global.mockDrizzle.query.driver.findFirst.mockResolvedValue(null);

    const mockValues = jest.fn().mockReturnThis();
    const mockReturning = jest.fn().mockResolvedValue([testDriver]);
    global.mockDrizzle.insert.mockReturnValue({
      values: mockValues,
      returning: mockReturning,
    });

    await driverService.createDriver(testDriver.userId, {
      firstName: testDriver.firstName,
      lastName: testDriver.lastName,
      email: testDriver.email,
      phone: testDriver.phone,
      country: testDriver.country,
      state: testDriver.state,
      city: testDriver.city,
      bankName: testDriver.bankName,
      accountNumber: testDriver.accountNumber,
      accountName: testDriver.accountName,
      profile_pic: testDriver.profile_pic,
    });

    expect(mockedEmitDriverIdentityCreated).toHaveBeenCalledWith(
      testDriver,
      global.mockDrizzle,
    );
  });

  it("publishes a driver.identity.updated event when a driver is updated", async () => {
    global.mockDrizzle.query.driver.findFirst.mockResolvedValue(testDriver);

    const updatedDriver = {
      ...testDriver,
      city: "Abuja",
      updatedAt: new Date("2025-07-02T00:00:00Z"),
    };

    global.mockDrizzle.update.mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([updatedDriver]),
    });

    await driverService.updateDriver(testDriver.userId, {
      city: "Abuja",
    });

    expect(mockedEmitDriverIdentityUpdated).toHaveBeenCalledWith(
      updatedDriver,
      global.mockDrizzle,
    );
  });

  it("publishes a driver.identity.deleted event when a driver is deleted", async () => {
    global.mockDrizzle.query.driver.findFirst.mockResolvedValue(testDriver);
    global.mockDrizzle.delete.mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });

    await driverService.deleteDriver(testDriver.userId);

    expect(mockedEmitDriverIdentityDeleted).toHaveBeenCalledWith(
      {
        driverId: testDriver.id,
        userId: testDriver.userId,
      },
      global.mockDrizzle,
    );
  });
});
