import { AxiosError } from "axios";

export const handleApiError = (
  err: unknown,
  fallbackMessage: string,
): never => {
  if (err instanceof AxiosError) {
    if (err.response?.data) {
      const { error, message, errors } = err.response.data as {
        error?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };
      const firstFieldError = errors
        ? Object.values(errors).flat().find(Boolean)
        : undefined;
      throw new Error(error || message || firstFieldError || fallbackMessage);
    }
    if (err.request) {
      throw new Error("Unable to connect to server");
    }
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new Error(fallbackMessage);
};
