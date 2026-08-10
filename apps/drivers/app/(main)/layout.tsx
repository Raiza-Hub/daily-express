import { ReactNode } from "react";
import Navbar from "~/components/Navbar";

const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
            </div>

            <div className="w-full flex flex-col flex-1">
                {children}
            </div>
        </div>
    );
}

export default Layout;
