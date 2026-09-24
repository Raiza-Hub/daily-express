import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "../api";
import type {
  Driver,
  ApiResponse,
  CreateDriverRequest,
  UpdateProfileRequest,
  VerifyBankRequest,
  VerifyBankResponse,
  VerifyKycRequest,
  VerifyKycResponse,
} from "@shared/types";
import { handleApiError } from "../utils";

export const getDriverFn = async (): Promise<Driver | null> => {
  try {
    const response = await driverApi.get<ApiResponse<Driver | null>>("/profile");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to get driver profile");
    }
    return response.data.data ?? null;
  } catch (err) {
    throw handleApiError(err, "Failed to get driver profile") ;
  }
};

interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export const presignProfileUploadFn = async (
  contentType: string,
  contentLength: number,
): Promise<PresignResponse> => {
  try {
    const response = await driverApi.post<ApiResponse<PresignResponse>>(
      "/profile/presign",
      { contentType, contentLength },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to generate upload URL");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to generate upload URL") ;
  }
};

export const uploadToR2Fn = async (uploadUrl: string, file: File): Promise<void> => {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};

export const confirmProfileUploadFn = async (
  key: string,
): Promise<{ profile_pic: string }> => {
  try {
    const response = await driverApi.post<ApiResponse<{ profile_pic: string }>>(
      "/profile/confirm",
      { key },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to confirm profile upload");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to confirm profile upload") ;
  }
};

export const createDriverFn = async (
  data: CreateDriverRequest,
): Promise<Driver> => {
  try {
    const response = await driverApi.post<ApiResponse<Driver>>("/create", data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to create driver profile");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to create driver profile") ;
  }
};

export const verifyBankFn = async (
  data: VerifyBankRequest,
): Promise<VerifyBankResponse> => {
  try {
    const response = await driverApi.post<ApiResponse<VerifyBankResponse>>(
      "/verify/bank",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to verify bank account");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to verify bank account") ;
  }
};

export const verifyKycFn = async (
  data: VerifyKycRequest,
): Promise<VerifyKycResponse> => {
  try {
    const response = await driverApi.post<ApiResponse<VerifyKycResponse>>(
      "/verify/kyc",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to verify identity");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to verify identity") ;
  }
};

export const updateDriverFn = async (
  data: UpdateProfileRequest,
): Promise<Driver> => {
  try {
    const response = await driverApi.put<ApiResponse<Driver>>("/update", data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update driver profile");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to update driver profile") ;
  }
};

export const deactivateDriverFn = async (): Promise<void> => {
  try {
    const response = await driverApi.delete<ApiResponse<null>>("/deactivate");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to deactivate driver profile");
    }
  } catch (err) {
    throw handleApiError(err, "Failed to deactivate driver profile") ;
  }
};

export const useGetDriver = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driver"],
    queryFn: getDriverFn,
    enabled: options?.enabled ?? true,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useCreateDriver = (options?: {
  onSuccess?: (data: Driver) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDriverFn,
    onSuccess: (data) => {
      queryClient.setQueryData(["driver"], data);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useVerifyBank = (options?: {
  onSuccess?: (data: VerifyBankResponse) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: verifyBankFn,
    ...options,
  });
};

export const useVerifyKyc = (options?: {
  onSuccess?: (data: VerifyKycResponse) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: verifyKycFn,
    ...options,
  });
};

export const useUpdateDriver = (options?: {
  onSuccess?: (data: Driver) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateDriverFn,
    onSuccess: (data) => {
      queryClient.setQueryData(["driver"], data);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useDeactivateDriver = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateDriverFn,
    onSuccess: () => {
      queryClient.clear();
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
};
