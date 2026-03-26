// import { axiosPublic } from "./api";
// import type { AxiosResponse } from "axios";

// interface TokenResponse {
//   accessToken: string;
//   refreshToken: string;
// }

// interface ApiResponse {
//   success: boolean;
//   data: TokenResponse;
//   message?: string;
//   error?: string;
// }

// export const refreshAccessToken = async (): Promise<{ accessToken: string; refreshToken: string }> => {
//   const response: AxiosResponse<ApiResponse> = await axiosPublic.post(
//     "/auth/refresh",
//     {},
//   );

//   if (!response.data.success) {
//     throw new Error(response.data.error || "Token refresh failed");
//   }

//   return response.data.data;
// };