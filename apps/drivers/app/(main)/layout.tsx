
import { ReactNode } from "react";
import Navbar from "../components/Navbar";

const Layout = async ({ children }: { children: ReactNode }) => {
    return (
        <div className="w-full min-h-screen">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
            </div>

            <div className="w-full flex flex-col">
                {children}
            </div>
        </div>
    );
}

export default Layout;