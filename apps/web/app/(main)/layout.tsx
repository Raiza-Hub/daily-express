import Footer from "@repo/ui/Footer";
import { ReactNode } from "react";
import Navbar from "~/components/Navbar";
import NavTabs from "~/components/NavTabs";


const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
                <div className="bg-gray-50 border-b border-neutral-200 flex flex-col">
                    <NavTabs />
                </div>
            </div>

            <main className="w-full flex flex-col px-4 md:px-6 py-6 gap-6 flex-1">
                {children}
            </main>

            <Footer className="max-w-7xl mx-auto mt-auto" />
        </div>
    )
}

export default Layout;