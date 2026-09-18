import { SettingsNav } from "~/components/user/SettingsNav";

export default function SettingsLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="grid gap-8 py-8 md:grid-cols-[224px_minmax(0,1fr)] md:gap-10">
            <SettingsNav />
            <div className="min-w-0">{children}</div>
        </div>
    );
}