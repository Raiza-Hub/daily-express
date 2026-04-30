import ResetPasswordForm from "~/components/auth-form/ResetPassword";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

const ResetPasswordPage = async ({ searchParams }: ResetPasswordPageProps) => {
  const { token } = await searchParams;
  const resetToken = Array.isArray(token) ? token[0] : token;

  return <ResetPasswordForm token={resetToken} />;
};

export default ResetPasswordPage;
