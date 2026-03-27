import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { User, ApiResponse, GetMeResponse, AuthTokens } from "@shared/types";
import { AxiosError } from "axios";

interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface VerifyOtpPayload {
  otp: string;
}

interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
}

interface ResetPasswordPayload {
  token: string;
  password: string;
}



const handleApiError = (err: unknown, fallbackMessage: string): never => {
  if (err instanceof AxiosError) {
    if (err.response?.data) {
      const { error, message } = err.response.data as {
        error?: string;
        message?: string;
      };
      throw new Error(error || message || fallbackMessage);
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

export const registerFn = async (
  data: RegisterPayload,
): Promise<GetMeResponse> => {
  try {
    const response = await api.post<ApiResponse<GetMeResponse>>(
      "/auth/register",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Registration failed");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Registration failed") as never;
  }
};

export const loginFn = async (data: LoginPayload): Promise<AuthTokens> => {
  try {
    const response = await api.post<ApiResponse<AuthTokens>>(
      "/auth/login",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Login failed");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Login failed") as never;
  }
};

export const verifyOtpFn = async (
  data: VerifyOtpPayload,
): Promise<AuthTokens> => {
  try {
    const response = await api.post<ApiResponse<AuthTokens>>(
      "/auth/verify-otp",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "OTP verification failed");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "OTP verification failed") as never;
  }
};

export const resendOtpFn = async (): Promise<void> => {
  try {
    const response = await api.get<ApiResponse<null>>(
      "/auth/resend-otp",
    );
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to resend OTP");
    }
  } catch (err) {
    return handleApiError(err, "Failed to resend OTP") as never;
  }
};

export const forgotPasswordFn = async (email: string): Promise<void> => {
  try {
    const response = await api.post<ApiResponse<null>>(
      "/auth/forget-password",
      { email },
    );
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to send reset email");
    }
  } catch (err) {
    return handleApiError(err, "Failed to send reset email") as never;
  }
};


export const resetPasswordFn = async ({
  token,
  password,
}: ResetPasswordPayload): Promise<void> => {
  try {
    const response = await api.post<ApiResponse<null>>(
      `/auth/reset-password/${token}`,
      { password },
    );
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to reset password");
    }
  } catch (err) {
    return handleApiError(err, "Failed to reset password") as never;
  }
};

export const logoutFn = async (): Promise<void> => {
  try {
    const response = await api.get<ApiResponse<null>>("/auth/logout");
    if (!response.data.success) {
      throw new Error(response.data.error || "Logout failed");
    }
  } catch (err) {
    return handleApiError(err, "Logout failed") as never;
  }
};

export const getMeFn = async (): Promise<User> => {
  try {
    const response = await api.get<ApiResponse<User>>("/auth/profile");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get user");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get user") as never;
  }
};

export const useGetMe = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["user"],
    queryFn: getMeFn,
    retry: false,
    staleTime: Infinity,
    enabled: options?.enabled ?? true,
  });
};

export const useRefetchUser = () => {
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: ["user"] });
};


export const updateProfileFn = async (
  data: UpdateProfilePayload,
): Promise<User> => {
  try {
    const response = await api.put<ApiResponse<User>>(
      "/auth/profile",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update profile");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update profile") as never;
  }
};

export const deleteAccountFn = async (): Promise<void> => {
  try {
    const response =
      await api.delete<ApiResponse<null>>("/auth/profile");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete account");
    }
  } catch (err) {
    return handleApiError(err, "Failed to delete account") as never;
  }
};

export const useRegister = () =>
  useMutation({
    mutationFn: registerFn,
  });

export const useLogin = () =>
  useMutation({
    mutationFn: loginFn,
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: verifyOtpFn,
  });

export const useResendOtp = () =>
  useMutation({
    mutationFn: resendOtpFn,
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: forgotPasswordFn,
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: resetPasswordFn,
  });

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useUpdateProfile = (options?: { onSuccess?: (data: any) => void; onError?: (error: any) => void }) =>
  useMutation({
    mutationFn: updateProfileFn,
    ...options,
  });

export const useDeleteAccount = () =>
  useMutation({
    mutationFn: deleteAccountFn,
  });

export type Provider = "google";

export const getProvidersFn = async (): Promise<Provider[]> => {
  try {
    const response = await api.get<ApiResponse<Provider[]>>("/auth/providers");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get providers");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get providers") as never;
  }
};

export const useGetProviders = () =>
  useQuery({
    queryKey: ["providers"],
    queryFn: getProvidersFn,
    retry: false,
  });

export const disconnectProviderFn = async (provider: Provider): Promise<void> => {
  try {
    const response = await api.delete<ApiResponse<null>>(`/auth/providers/${provider}`);
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to disconnect provider");
    }
  } catch (err) {
    return handleApiError(err, "Failed to disconnect provider") as never;
  }
};

export const useDisconnectProvider = (options?: { onSuccess?: () => void; onError?: (error: any) => void }) =>
  useMutation({
    mutationFn: disconnectProviderFn,
    ...options,
  });

export const setPasswordFn = async (password: string): Promise<void> => {
  try {
    const response = await api.post<ApiResponse<null>>("/auth/password", { password });
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to set password");
    }
  } catch (err) {
    return handleApiError(err, "Failed to set password") as never;
  }
};

export const useSetPassword = (options?: { onSuccess?: () => void; onError?: (error: any) => void }) =>
  useMutation({
    mutationFn: setPasswordFn,
    ...options,
  });
