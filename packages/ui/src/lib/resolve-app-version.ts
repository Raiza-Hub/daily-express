type AppVersionEnv = Record<string, string | undefined>;

export function resolveAppVersion(env: AppVersionEnv) {
  return env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_GIT_COMMIT_SHA ?? "development";
}
