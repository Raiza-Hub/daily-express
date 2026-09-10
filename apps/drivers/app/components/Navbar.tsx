import Link from "next/link";

import NavItem from "./NavItem";
import { UserAccountNav } from "./UserAccountNav";
import Image from "next/image";

const Navbar = async () => {
  return (
    <div className="w-full flex items-center justify-between h-16 px-4 md:p-6 sticky top-0 bg-white z-50 border-b border-neutral-200 ">
      <div className="flex h-16 items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/nav-logo.png"
              alt="Daily Express logo"
              width={28}
              height={29}
              className="h-auto w-7 object-contain object-center"
            />
            <span className="text-lg sm:text-xl font-medium leading-none">
              Daily Express
            </span>
          </Link>
        </div>


        <div className="hidden z-50 lg:ml-8 lg:flex lg:items-center lg:">
          <NavItem label="Vehicles" href="/vehicles" />
          {/* <NavItem label="Payouts" href="/payouts" /> */}
          <NavItem label="Settings" href="/settings/profile" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 ml-2">
          <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
            <UserAccountNav />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
