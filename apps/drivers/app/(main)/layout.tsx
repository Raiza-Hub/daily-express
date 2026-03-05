
import { ReactNode } from "react";
import Navbar from "../components/Navbar";
import Footer from "@repo/ui/Footer";


const Layout = async ({ children }: { children: ReactNode }) => {
    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
            </div>

            <div className="w-full flex flex-col flex-1">
                {children}
            </div>
            <Footer className="px-2.5 md:p-6 mt-auto" />
        </div>
    );
}

export default Layout;