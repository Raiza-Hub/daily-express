import type { Metadata } from "next";
import AuthNavbar from "./AuthNavbar";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};






export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="w-full min-h-screen flex flex-col ">
            <AuthNavbar />

            <div>{children}</div>
        </div>
    );
}
