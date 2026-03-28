// Zustand store commented out - using cookies + React Query for auth
// import { create } from "zustand";
// import type { User } from "@shared/types";

// export type { User };

// interface AuthState {
//   user: User | null;
//   // accessToken: string | null;
//   refreshToken: string | null;
//   isAuthenticated: boolean;
//   isAuthLoading: boolean;
//   setAuth: (user: User, accessToken: string, refreshToken: string) => void;
//   setTokens: (accessToken: string, refreshToken: string) => void;
//   updateUser: (updates: Partial<User>) => void;
//   logout: () => void;
//   setAuthLoading: (loading: boolean) => void;
// }

// export const useAuthStore = create<AuthState>((set) => ({
//   user: null,
//   // accessToken: null,
//   refreshToken: null,
//   isAuthenticated: false,
//   isAuthLoading: true,
//   setAuth: (user, _accessToken, refreshToken) =>
//     set({ user, /* accessToken, */ refreshToken, isAuthenticated: true }),
//   setTokens: (_accessToken, refreshToken) => set({ /* accessToken, */ refreshToken }),
//   updateUser: (updates) =>
//     set((state) => ({
//       user: state.user ? { ...state.user, ...updates } : null,
//     })),
//   logout: () =>
//     set({
//       user: null,
//       // accessToken: null,
//       refreshToken: null,
//       isAuthenticated: false,
//       isAuthLoading: false,
//     }),
//   setAuthLoading: (loading) => set({ isAuthLoading: loading }),
// }));

// For backward compatibility, export mock functions that do nothing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// export const useAuthStore = () => ({
//   user: null,
//   refreshToken: null,
//   isAuthenticated: false,
//   isAuthLoading: false,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   setAuth: (_user?: any, _accessToken?: string, _refreshToken?: string) => {},
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   setTokens: (_accessToken?: string, _refreshToken?: string) => {},
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   updateUser: (_updates?: any) => {},
//   logout: () => {},
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   setAuthLoading: (_loading?: boolean) => {},
// });