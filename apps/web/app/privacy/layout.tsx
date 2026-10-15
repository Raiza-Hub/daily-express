import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "What Daily Express collects, why we collect it, who we share it with, and the rights you have over it under the Nigeria Data Protection Act.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return children;
}