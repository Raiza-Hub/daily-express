import { useMutation, useQuery } from "@tanstack/react-query";
import { driverApi } from "../api";
import type {
  Driver,
  ApiResponse,
  CreateDriverRequest,
  UpdateProfileRequest,
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
    return handleApiError(err, "Failed to get driver profile") as never;
  }
};

export interface PresignResponse {
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
    return handleApiError(err, "Failed to generate upload URL") as never;
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
    return handleApiError(err, "Failed to create driver profile") as never;
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
    return handleApiError(err, "Failed to update driver profile") as never;
  }
};

export const deactivateDriverFn = async (): Promise<void> => {
  try {
    const response = await driverApi.delete<ApiResponse<null>>("/deactivate");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to deactivate driver profile");
    }
  } catch (err) {
    return handleApiError(err, "Failed to deactivate driver profile") as never;
  }
};

export const useGetDriver = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driver"],
    queryFn: getDriverFn,
    retry: false,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchInterval: (query) => {
      const status = query.state.data?.bankVerificationStatus;
      return status === "pending" ? 5000 : false;
    },
  });
};

export const useCreateDriver = (options?: {
  onSuccess?: (data: Driver) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: createDriverFn,
    ...options,
  });
};

export const useUpdateDriver = (options?: {
  onSuccess?: (data: Driver) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: updateDriverFn,
    ...options,
  });
};

export const usePresignProfileUpload = () => {
  return useMutation({
    mutationFn: ({ contentType, contentLength }: { contentType: string; contentLength: number }) =>
      presignProfileUploadFn(contentType, contentLength),
  });
};

export const useDeactivateDriver = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: deactivateDriverFn,
    ...options,
  });
};

export interface DriverStats {
  id: string;
  driverId: string;
  totalEarnings: number;
  pendingPayments: number;
  inReviewPayments: number;
  totalPassengers: number;
  createdAt: string;
  updatedAt: string;
}

export const getDriverStatsFn = async (): Promise<DriverStats> => {
  try {
    const response =
      await driverApi.get<ApiResponse<DriverStats>>("/stats");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get driver stats");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get driver stats") as never;
  }
};

export const useGetDriverStats = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driverStats"],
    queryFn: getDriverStatsFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};
