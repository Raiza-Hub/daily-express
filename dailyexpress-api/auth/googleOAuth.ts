import axios from "axios";
import type { CookieOptions, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { type User } from "../db/index";
import { getCookieDomain, setAuthCookies } from "../middleware/auth";
import { logger, reportError } from "../utils/logger";
import { AuthRepository } from "./auth.repository";
import { isUnder13 } from "./validation";
import {
    GOOGLE_AUTH_FAILURE_REDIRECT_URL,
    resolveFrontendRedirect,
} from "./authUrls";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people/me";
const GOOGLE_ISSUER = "https://accounts.google.com";
const OAUTH_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;
const OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/user.birthday.read",
].join(" ");

const OAUTH_COOKIE_NAMES = [
  "oauth_state",
  "oauth_nonce",
  "oauth_code_verifier",
  "oauth_redirect",
] as const;

type OAuthCookieName = (typeof OAUTH_COOKIE_NAMES)[number];

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleIdPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  nonce?: string;
  given_name?: string;
  family_name?: string;
  birthdate?: string;
  picture?: string;
}

interface GooglePeopleResponse {
  names?: Array<{ givenName?: string; familyName?: string }>;
  birthdays?: Array<{
    date?: { year?: number; month?: number; day?: number };
  }>;
}

interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  picture: string | null;
}

class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

const repo = new AuthRepository();

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier(): string {
  return base64Url(randomBytes(64));
}

function createCodeChallenge(codeVerifier: string): string {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

function getOAuthCookieOptions(maxAge?: number): CookieOptions {
  const config = getConfig();
  const cookieDomain = getCookieDomain(config);

  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    signed: true,
    ...(typeof maxAge === "number" ? { maxAge } : {}),
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

function getQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getSignedCookie(req: Request, name: OAuthCookieName): string | null {
  const signedCookies = req.signedCookies as Record<string, unknown> | undefined;
  const value = signedCookies?.[name];
  return typeof value === "string" ? value : null;
}

export function clearGoogleOAuthCookies(res: Response): void {
  for (const name of OAUTH_COOKIE_NAMES) {
    res.clearCookie(name, getOAuthCookieOptions());
  }
}

export function startGoogleOAuth(req: Request, res: Response): string {
  const config = getConfig();
  const state = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const redirectTarget = resolveFrontendRedirect(
    getQueryValue(req.query.redirect) ||
      getQueryValue(req.query.returnTo) ||
      getQueryValue(req.query.state),
  );
  const cookieOptions = getOAuthCookieOptions(OAUTH_COOKIE_MAX_AGE_MS);

  res.cookie("oauth_state", state, cookieOptions);
  res.cookie("oauth_nonce", nonce, cookieOptions);
  res.cookie("oauth_code_verifier", codeVerifier, cookieOptions);
  res.cookie("oauth_redirect", redirectTarget, cookieOptions);

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", config.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", config.GOOGLE_CALLBACK_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", OAUTH_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("access_type", "online");

  return authUrl.toString();
}

export async function completeGoogleOAuth(
  req: Request,
  res: Response,
): Promise<string> {
  try {
    const redirectTarget =
      getSignedCookie(req, "oauth_redirect") || resolveFrontendRedirect();
    const code = getQueryValue(req.query.code);
    const returnedState = getQueryValue(req.query.state);
    const expectedState = getSignedCookie(req, "oauth_state");
    const expectedNonce = getSignedCookie(req, "oauth_nonce");
    const codeVerifier = getSignedCookie(req, "oauth_code_verifier");

    if (!code) throw new GoogleOAuthError("Missing Google OAuth code");
    if (!returnedState) throw new GoogleOAuthError("Missing Google OAuth state");
    if (!expectedState || returnedState !== expectedState)
      throw new GoogleOAuthError("Invalid Google OAuth state");
    if (!expectedNonce) throw new GoogleOAuthError("Missing Google OAuth nonce cookie");
    if (!codeVerifier) throw new GoogleOAuthError("Missing Google OAuth PKCE verifier");

    const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
    const profile = await verifyGoogleIdentity(tokenResponse, expectedNonce);
    const user = await upsertGoogleUser(profile);
    const config = getConfig();

    setAuthCookies(
      res,
      {
        userId: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      config,
    );
    clearGoogleOAuthCookies(res);

    return resolveFrontendRedirect(redirectTarget);
  } catch (error) {
    clearGoogleOAuthCookies(res);

    if (error instanceof GoogleOAuthError) {
      logger.warn("auth.google_oauth_rejected", { reason: error.message });
    } else {
      reportError(error, {
        source: "google-oauth",
        message: "Google OAuth callback failed",
      });
    }

    return GOOGLE_AUTH_FAILURE_REDIRECT_URL;
  }
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    redirect_uri: config.GOOGLE_CALLBACK_URL,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
  });

  const response = await axios.post<GoogleTokenResponse>(
    GOOGLE_TOKEN_URL,
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  if (!response.data.id_token || !response.data.access_token) {
    throw new GoogleOAuthError("Google token response is missing tokens");
  }

  return response.data;
}

async function verifyGoogleIdentity(
  tokenResponse: GoogleTokenResponse,
  expectedNonce: string,
): Promise<GoogleProfile> {
  const config = getConfig();
  const oauthClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokenResponse.id_token!,
    audience: config.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload() as GoogleIdPayload | undefined;

  if (!payload) throw new GoogleOAuthError("Google ID token has no payload");
  if (payload.iss !== GOOGLE_ISSUER) throw new GoogleOAuthError("Google ID token issuer is invalid");
  if (payload.aud !== config.GOOGLE_CLIENT_ID) throw new GoogleOAuthError("Google ID token audience is invalid");
  if (!payload.sub) throw new GoogleOAuthError("Google ID token is missing subject");
  if (!payload.email) throw new GoogleOAuthError("Google ID token is missing email");
  if (payload.email_verified !== true) throw new GoogleOAuthError("Google email is not verified");
  if (payload.nonce !== expectedNonce) throw new GoogleOAuthError("Google ID token nonce is invalid");

  const profileFromToken = {
    firstName: payload.given_name,
    lastName: payload.family_name,
    dateOfBirth: parseBirthdate(payload.birthdate),
  };
  const needsPeopleApi =
    !profileFromToken.firstName ||
    !profileFromToken.lastName ||
    !profileFromToken.dateOfBirth;
  const profileFromPeople = needsPeopleApi
    ? await getGoogleUserInfo(tokenResponse.access_token!)
    : null;

  return {
    googleId: payload.sub,
    email: payload.email,
    firstName:
      profileFromToken.firstName || profileFromPeople?.firstName || "Google",
    lastName: profileFromToken.lastName || profileFromPeople?.lastName || "User",
    dateOfBirth:
      profileFromToken.dateOfBirth || profileFromPeople?.dateOfBirth || null,
    picture: payload.picture || null,
  };
}

async function getGoogleUserInfo(accessToken: string) {
  try {
    const response = await axios.get<GooglePeopleResponse>(GOOGLE_PEOPLE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { personFields: "names,birthdays" },
    });

    const name = response.data.names?.[0];
    const birthday = response.data.birthdays?.[0]?.date;

    return {
      firstName: name?.givenName || "Google",
      lastName: name?.familyName || "User",
      dateOfBirth: parseGoogleBirthday(birthday),
    };
  } catch (error) {
    reportError(error, {
      source: "google-people-api",
      message: "Error fetching Google user info",
    });
    return { firstName: "Google", lastName: "User", dateOfBirth: null };
  }
}

function parseGoogleBirthday(
  birthday: { year?: number; month?: number; day?: number } | undefined,
): Date | null {
  if (!birthday?.year || !birthday.month || !birthday.day) return null;
  return new Date(birthday.year, birthday.month - 1, birthday.day);
}

function parseBirthdate(birthdate: string | undefined): Date | null {
  if (!birthdate) return null;
  const parsed = new Date(birthdate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  return db.transaction(async (tx) => {
    const existingProvider = await repo.findUserProvider(tx, "google", profile.googleId);

    if (existingProvider) {
      const updatedUser = await repo.updateUser(tx, existingProvider.userId, {
        profilePictureUrl: profile.picture,
        updatedAt: new Date(),
      });
      if (!updatedUser) {
        throw new GoogleOAuthError("Google provider is linked to a missing user");
      }
      return updatedUser;
    }

    const existingUserByEmail = await repo.findUserByEmail(profile.email);

    if (existingUserByEmail) {
      await repo.insertUserProvider(tx, {
        userId: existingUserByEmail.id,
        provider: "google",
        providerId: profile.googleId,
      });

      const updated = await repo.updateUser(tx, existingUserByEmail.id, {
        profilePictureUrl: profile.picture,
        updatedAt: new Date(),
      });
      if (!updated) {
        throw new GoogleOAuthError("Failed to update existing user");
      }
      return updated;
    }

    if (profile.dateOfBirth && isUnder13(profile.dateOfBirth)) {
      throw new GoogleOAuthError(
        "You must be at least 13 years old to create an account",
      );
    }

    const createdUser = await repo.insertUser(tx, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      password: null,
      dateOfBirth: profile.dateOfBirth || new Date(0),
      emailVerified: true,
      referral: "",
      profilePictureUrl: profile.picture,
    });

    await repo.insertUserProvider(tx, {
      userId: createdUser.id,
      provider: "google",
      providerId: profile.googleId,
    });

    return createdUser;
  });
}
