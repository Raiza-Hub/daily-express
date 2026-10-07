import axios from "axios";
import { getConfig } from "../config/index";

type CallEntry = {
  phoneNumber?: string;
  status?: string;
  sessionId?: string;
  errorMessage?: string | null;
};

type CallResponse = {
  entries?: CallEntry[];
  errorMessage?: string | null;
};

function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/^0+/, "")}`;
}

export class AfricasTalkingVoiceClient {
  async call(input: {
    to: string;
    clientRequestId: string;
    callbackUrl: string;
  }): Promise<void> {
    const config = getConfig();
    if (
      !config.AFRICASTALKING_USERNAME ||
      !config.AFRICASTALKING_API_KEY ||
      !config.AFRICASTALKING_VOICE_BASE_URL ||
      !config.AFRICASTALKING_VOICE_NUMBER
    ) {
      throw new Error("Africa's Talking Voice is not configured");
    }

    const to = toE164(input.to);
    const body = new URLSearchParams({
      username: config.AFRICASTALKING_USERNAME,
      from: config.AFRICASTALKING_VOICE_NUMBER,
      to,
      clientRequestId: input.clientRequestId,
      voiceCallBackUrl: input.callbackUrl,
    });

    const response = await axios.post<CallResponse>(
      `${config.AFRICASTALKING_VOICE_BASE_URL}/call`,
      body.toString(),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: config.AFRICASTALKING_API_KEY,
        },
        timeout: 10_000,
      },
    );

    const data = response.data ?? {};
    const entries = data.entries ?? [];
    const rejected = entries.filter(
      (entry) => (entry.status ?? "").toLowerCase() !== "queued",
    );
    const topLevelError =
      data.errorMessage && data.errorMessage.toLowerCase() !== "none";

    if (entries.length === 0 || topLevelError || rejected.length > 0) {
      const detail =
        rejected[0]?.errorMessage ??
        data.errorMessage ??
        `expected a queued entry, got ${JSON.stringify(data.entries ?? null)}`;
      throw new Error(`Africa's Talking did not queue the call: ${detail}`);
    }
  }
}

export const africasTalkingVoiceClient = new AfricasTalkingVoiceClient();