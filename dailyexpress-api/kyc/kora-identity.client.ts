import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import type { KoraIdentityEnvelope, KoraIdentityResponse } from "./kyc.types";

class KoraIdentityClient {
  private baseUrl: string;
  private secretKey: string;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.KORA_BASE_URL;
    this.secretKey = config.KORA_SECRET_KEY;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const body = await response.json();
        errorMessage = (body as { message?: string }).message || errorMessage;
      } catch {}
      throw new Error(`Kora Identity API error: ${errorMessage}`);
    }

    const raw = (await response.json()) as KoraIdentityEnvelope;
    if (raw.status === false || !raw.data) {
      throw new Error(`Kora Identity API error: ${raw.message || "Verification failed"}`);
    }

    return raw.data as T;
  }

  async verifyBVN(
    id: string,
    validation?: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      selfie?: string;
    },
  ) {
    const body: Record<string, unknown> = {
      id,
      verification_consent: true,
    };

    if (validation) {
      const v: Record<string, string> = {};
      if (validation.firstName) v.first_name = validation.firstName;
      if (validation.lastName) v.last_name = validation.lastName;
      if (validation.dateOfBirth) v.date_of_birth = validation.dateOfBirth;
      if (validation.selfie) v.selfie = validation.selfie;
      if (Object.keys(v).length > 0) {
        body.validation = v;
      }
    }

    logger.info("kyc.bvn_verification.started", { id: maskId(id) });
    const result = await this.request<KoraIdentityResponse>(
      "/merchant/api/v1/identities/ng/bvn",
      body,
    );
    logger.info("kyc.bvn_verification.completed", { reference: result.reference });
    return result;
  }

  async verifyNIN(
    id: string,
    validation?: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      selfie?: string;
    },
  ) {
    const body: Record<string, unknown> = {
      id,
      verification_consent: true,
    };

    if (validation) {
      const v: Record<string, string> = {};
      if (validation.firstName) v.first_name = validation.firstName;
      if (validation.lastName) v.last_name = validation.lastName;
      if (validation.dateOfBirth) v.date_of_birth = validation.dateOfBirth;
      if (validation.selfie) v.selfie = validation.selfie;
      if (Object.keys(v).length > 0) {
        body.validation = v;
      }
    }

    logger.info("kyc.nin_verification.started", { id: maskId(id) });
    const result = await this.request<KoraIdentityResponse>(
      "/merchant/api/v1/identities/ng/nin",
      body,
    );
    logger.info("kyc.nin_verification.completed", { reference: result.reference });
    return result;
  }
}

function maskId(id: string): string {
  if (id.length <= 4) return "***";
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}

export const koraIdentityClient = new KoraIdentityClient();
