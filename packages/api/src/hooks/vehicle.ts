import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "../api";
import type {
  ApiResponse,
  Vehicle,
  CreateVehicleRequest,
  UpdateVehicleRequest,
} from "@shared/types";
import { handleApiError } from "../utils";

export const getVehiclesFn = async (): Promise<Vehicle[]> => {
  try {
    const response = await driverApi.get<ApiResponse<Vehicle[]>>("/vehicles");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get vehicles");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get vehicles") as never;
  }
};

export const createVehicleFn = async (
  data: CreateVehicleRequest,
): Promise<Vehicle> => {
  try {
    const response = await driverApi.post<ApiResponse<Vehicle>>(
      "/vehicles",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to create vehicle");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to create vehicle") as never;
  }
};

export const updateVehicleFn = async ({
  id,
  data,
}: {
  id: string;
  data: UpdateVehicleRequest;
}): Promise<Vehicle> => {
  try {
    const response = await driverApi.patch<ApiResponse<Vehicle>>(
      `/vehicles/${id}`,
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update vehicle");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update vehicle") as never;
  }
};

export const deleteVehicleFn = async (id: string): Promise<void> => {
  try {
    const response = await driverApi.delete<ApiResponse<null>>(
      `/vehicles/${id}`,
    );
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete vehicle");
    }
  } catch (err) {
    return handleApiError(err, "Failed to delete vehicle") as never;
  }
};

export const useGetVehicles = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehiclesFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useCreateVehicle = (options?: {
  onSuccess?: (data: Vehicle) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicleFn,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useUpdateVehicle = (options?: {
  onSuccess?: (data: Vehicle) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateVehicleFn,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useDeleteVehicle = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteVehicleFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
};
