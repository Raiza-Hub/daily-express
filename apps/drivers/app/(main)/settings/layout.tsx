import { ReactNode } from "react";
import SettingNavTabs from "../../components/settings/SettingTabs";
import Navbar from "../../components/Navbar";


const Layout = async ({ children }: { children: ReactNode }) => {
    return (
        <div className="w-full">
            <div className="bg-white sticky top-16 z-50">
                {/* <Navbar /> */}
                <div className="flex flex-col">
                    <SettingNavTabs />
                </div>
            </div>

            <div className="w-full max-w-3xl mx-auto flex flex-col p-6">
                {children}
            </div>
        </div>
    );
}

export default Layout;