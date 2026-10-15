import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Use",
    description:
        "The terms that govern booking a trip, paying for it, and driving with Daily Express in Nigeria.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
    return children;
}