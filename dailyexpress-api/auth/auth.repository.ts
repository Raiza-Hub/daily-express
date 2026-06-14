import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "../db/connection";
import { users, otp, passwordResetTokens, userProviders } from "../db/index";
import { driver } from "../db/index";

type AuthTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type UserRecord = typeof users.$inferSelect;
type OtpRecord = typeof otp.$inferSelect;
type PasswordResetTokenRecord = typeof passwordResetTokens.$inferSelect;
type UserProviderRecord = typeof userProviders.$inferSelect;
type DriverRecord = typeof driver.$inferSelect;

export class AuthRepository {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return (await db.query.users.findFirst({ where: eq(users.email, email) })) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
  }

  async insertUser(
    tx: AuthTransaction,
    data: typeof users.$inferInsert,
  ): Promise<UserRecord> {
    const [created] = await tx.insert(users).values(data).returning();
    return created;
  }

  async updateUser(
    tx: AuthTransaction | typeof db,
    id: string,
    values: Partial<typeof users.$inferInsert>,
  ): Promise<UserRecord | undefined> {
    const [updated] = await tx
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async updateUserStandalone(
    id: string,
    values: Partial<typeof users.$inferInsert>,
  ): Promise<UserRecord[]> {
    return db.update(users).set(values).where(eq(users.id, id)).returning();
  }

  async findOtpByEmail(email: string): Promise<OtpRecord | null> {
    return (await db.query.otp.findFirst({ where: eq(otp.email, email) })) ?? null;
  }

  async insertOtp(
    tx: AuthTransaction,
    values: typeof otp.$inferInsert,
  ): Promise<void> {
    await tx.insert(otp).values(values);
  }

  async updateOtp(
    tx: AuthTransaction,
    email: string,
    values: Partial<typeof otp.$inferInsert>,
  ): Promise<void> {
    await tx.update(otp).set(values).where(eq(otp.email, email));
  }

  async deleteOtp(email: string): Promise<void> {
    await db.delete(otp).where(eq(otp.email, email));
  }

  async findPasswordResetTokenByHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null> {
    return (await db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.tokenHash, tokenHash) })) ?? null;
  }

  async invalidatePasswordResetTokens(
    tx: AuthTransaction,
    userId: string,
  ): Promise<void> {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
  }

  async insertPasswordResetToken(
    tx: AuthTransaction,
    values: typeof passwordResetTokens.$inferInsert,
  ): Promise<void> {
    await tx.insert(passwordResetTokens).values(values);
  }

  async deletePasswordResetTokensByUser(
    tx: AuthTransaction,
    userId: string,
  ): Promise<void> {
    await tx
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
  }

  async findUserProviders(userId: string): Promise<Pick<UserProviderRecord, "provider">[]> {
    return db.query.userProviders.findMany({
      where: eq(userProviders.userId, userId),
      columns: { provider: true },
    });
  }

  async deleteUserProvider(userId: string, provider: string): Promise<void> {
    await db
      .delete(userProviders)
      .where(
        and(
          eq(userProviders.userId, userId),
          eq(userProviders.provider, provider),
        ),
      );
  }

  async deleteUserProvidersByUser(
    tx: AuthTransaction,
    userId: string,
  ): Promise<void> {
    await tx
      .delete(userProviders)
      .where(eq(userProviders.userId, userId));
  }

  async findUserLoginSummary(userId: string) {
    const [summary] = await db
      .select({
        password: users.password,
        providerCount: count(userProviders.id),
      })
      .from(users)
      .leftJoin(userProviders, eq(userProviders.userId, users.id))
      .where(eq(users.id, userId))
      .groupBy(users.id);
    return summary ?? null;
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
}
