import { useMutation, useQuery } from "@tanstack/react-query";
import { driverApi } from "../api";
import type {
  Driver,
  ApiResponse,
  CreateDriverRequest,
  UpdateProfileRequest,
} from "@shared/types";
import { handleApiError } from "../utils";

export const getDriverFn = async (): Promise<Driver> => {
  try {
    const response = await driverApi.get<ApiResponse<Driver>>("/profile");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get driver profile");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get driver profile") as never;
  }
};

export const createDriverFn = async (
  data: CreateDriverRequest | FormData,
): Promise<Driver> => {
  const isFormData = data instanceof FormData;
  try {
    const response = await driverApi.post<ApiResponse<Driver>>(
      "/create",
      data,
      {
        headers: isFormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
      },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to create driver profile");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to create driver profile") as never;
  }
};

export const updateDriverFn = async (
  data: UpdateProfileRequest | FormData,
): Promise<Driver> => {
  const isFormData = data instanceof FormData;
  try {
    const response = await driverApi.put<ApiResponse<Driver>>(
      "/update",
      data,
      {
        headers: isFormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
      },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update driver profile");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update driver profile") as never;
  }
};

export const deleteDriverFn = async (): Promise<void> => {
  try {
    const response = await driverApi.delete<ApiResponse<null>>("/delete");
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete driver profile");
    }
  } catch (err) {
    return handleApiError(err, "Failed to delete driver profile") as never;
  }
};

export const useGetDriver = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driver"],
    queryFn: getDriverFn,
    retry: false,
    enabled: options?.enabled ?? true,
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

export const useDeleteDriver = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: deleteDriverFn,
    ...options,
  });
};

export interface DriverStats {
  id: string;
  driverId: string;
  totalEarnings: number;
  pendingPayments: number;
  totalPassengers: number;
  activeRoutes: number;
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
