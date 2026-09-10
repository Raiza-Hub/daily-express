import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api";
import type { User, ApiResponse, OnboardingInput } from "@shared/types";
import { handleApiError } from "../utils";

interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  phoneNumber?: string;
  gender?: "male" | "female";
}

export const logoutFn = async (): Promise<void> => {
  try {
    const response = await authApi.get<ApiResponse<null>>("/logout");
    if (!response.data.success) {
      throw new Error(response.data.error || "Logout failed");
    }
  } catch (err) {
    return handleApiError(err, "Logout failed") as never;
  }
};

export const getMeFn = async (): Promise<User> => {
  try {
    const response = await authApi.get<ApiResponse<User>>("/profile");
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
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const updateProfileFn = async (
  data: UpdateProfilePayload,
): Promise<User> => {
  try {
    const response = await authApi.put<ApiResponse<User>>(
      "/update-profile",
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
    const response = await authApi.delete<ApiResponse<null>>("/delete-account");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete account");
    }
  } catch (err) {
    return handleApiError(err, "Failed to delete account") as never;
  }
};

export const completeOnboardingFn = async (
  data: OnboardingInput,
): Promise<User> => {
  try {
    const response = await authApi.patch<ApiResponse<User>>(
      "/profile/complete",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to complete onboarding");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to complete onboarding") as never;
  }
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useUpdateProfile = (options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) =>
  useMutation({
    mutationFn: updateProfileFn,
    ...options,
  });

export const useDeleteAccount = () =>
  useMutation({
    mutationFn: deleteAccountFn,
  });

export const useCompleteOnboarding = (options?: {
  onSuccess?: (data: User) => void;
  onError?: (error: any) => void;
}) =>
  useMutation({
    mutationFn: completeOnboardingFn,
    ...options,
  });