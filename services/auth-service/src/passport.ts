import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db/db";
import { users, userProviders } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "../db/schema";
import axios from "axios";

interface GoogleUserInfo {
  names?: Array<{
    givenName: string;
    familyName: string;
  }>;
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }>;
}

async function getGoogleUserInfo(accessToken: string): Promise<{
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
}> {
  try {
    const response = await axios.get<GoogleUserInfo>(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          personFields: "names,birthdays",
        },
      },
    );

    const name = response.data.names?.[0];
    const birthday = response.data.birthdays?.[0]?.date;

    const firstName = name?.givenName || "Google";
    const lastName = name?.familyName || "User";

    let dateOfBirth: Date | null = null; // Default to null instead of today
    if (birthday?.year && birthday?.month && birthday?.day) {
      dateOfBirth = new Date(birthday.year, birthday.month - 1, birthday.day);
    }

    return { firstName, lastName, dateOfBirth };
  } catch (error) {
    console.error("Error fetching Google user info:", error);
    return {
      firstName: "Google",
      lastName: "User",
      dateOfBirth: null,
    };
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/user.birthday.read",
      ],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleEmail = profile.emails?.[0]?.value;
        const googleId = profile.id;

        if (!googleEmail) {
          return done(new Error("No email provided by Google"), undefined);
        }

        // Get additional user info from Google People API
        const { firstName, lastName, dateOfBirth } =
          await getGoogleUserInfo(accessToken);

        // Check if user exists with this Google provider
        const existingProvider = await db.query.userProviders.findFirst({
          where: and(
            eq(userProviders.provider, "google"),
            eq(userProviders.providerId, googleId),
          ),
        });

        if (existingProvider) {
          // User already has Google linked - get full user
          const user = await db.query.users.findFirst({
            where: eq(users.id, existingProvider.userId),
          });

          if (!user) {
            return done(new Error("User not found"), undefined);
          }

          return done(null, user);
        }

        // Check if user exists with same email (can link Google account)
        const existingUserByEmail = await db.query.users.findFirst({
          where: eq(users.email, googleEmail),
        });

        if (existingUserByEmail) {
          // Link Google account to existing user
          await db.insert(userProviders).values({
            userId: existingUserByEmail.id,
            provider: "google",
            providerId: googleId,
          });

          return done(null, existingUserByEmail);
        }

        // Create new user with Google provider
        const [newUser] = await db
          .insert(users)
          .values({
            email: googleEmail,
            firstName,
            lastName,
            password: null, // No password for Google users
            dateOfBirth: dateOfBirth || new Date(0),
            emailVerified: true, // Google verifies email
            referal: "",
          })
          .returning();

        // Create provider record
        await db.insert(userProviders).values({
          userId: newUser.id,
          provider: "google",
          providerId: googleId,
        });

        return done(null, newUser);
      } catch (error) {
        return done(error as Error, undefined);
      }
    },
  ),
);

// Serialize user to session
passport.serializeUser((user: unknown, done) => {
  done(null, (user as User).id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
