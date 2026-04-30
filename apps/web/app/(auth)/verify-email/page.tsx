import VerifyEmailForm from "~/components/auth-form/VerifyEmail";


const VerifyEmailPage = async ({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string }>;
}) => {
    const { redirect } = await searchParams;

    return (
       <VerifyEmailForm redirect={redirect} />
    );
}

export default VerifyEmailPage;
