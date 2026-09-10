import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { users, userProviders } from "../db/index";
import { driver, type DriverRecord, type UserRecord, type UserProviderRecord } from "../db/index";
import type { DbTransaction } from "../db/connection";

type AuthTransaction = DbTransaction;

export class AuthRepository {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return (await db.query.users.findFirst({ where: eq(users.email, email) })) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
  }

  async findUserByPhone(phone: string): Promise<UserRecord | null> {
    return (await db.query.users.findFirst({ where: eq(users.phone, phone) })) ?? null;
  }

  async insertUser(
    tx: AuthTransaction,
    data: typeof users.$inferInsert,
  ): Promise<UserRecord> {
    const [created] = await tx.insert(users).values(data).returning();
    return created;
  }

  async updateUser(
    tx: AuthTransaction,
    id: string,
    values: Partial<typeof users.$inferInsert>,
  ): Promise<UserRecord> {
    const [updated] = await tx
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async findDriverByUserId(userId: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.userId, userId) })) ?? null;
  }

  async findUserProvider(
    tx: AuthTransaction | typeof db,
    provider: string,
    providerId: string,
  ): Promise<UserProviderRecord | null> {
    return (
      (await tx.query.userProviders.findFirst({
        where: and(
          eq(userProviders.provider, provider),
          eq(userProviders.providerId, providerId),
        ),
      })) ?? null
    );
  }

  async insertUserProvider(
    tx: AuthTransaction,
    values: typeof userProviders.$inferInsert,
  ): Promise<void> {
    await tx.insert(userProviders).values(values);
  }

  async deleteUserProvidersByUser(
    tx: AuthTransaction,
    userId: string,
  ): Promise<void> {
    await tx
      .delete(userProviders)
      .where(eq(userProviders.userId, userId));
  }
}

export const authRepository = new AuthRepository();