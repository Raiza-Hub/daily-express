export function resolveAppVersion() {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? "development";
}
