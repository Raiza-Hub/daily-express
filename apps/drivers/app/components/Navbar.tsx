import Link from "next/link";

import NavItem from "./NavItem";
import NotificationInbox from "./NotificationInbox";
import { UserAccountNav } from "./UserAccountNav";
import CreateRouteDialog from "./CreateRouteDialog";
import Image from "next/image";
import MobileNav from "./MobileNav";

const Navbar = async () => {
  return (
    <div className="w-full flex items-center justify-between h-16 px-4 md:p-6 sticky top-0 bg-white z-50 border-b border-neutral-200 ">
      <div className="flex h-16 items-center gap-3">
        <MobileNav />

        <div className="flex">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Logo"
              width={520}
              height={530}
              className="object-contain object-center"
              style={{ width: "40px", height: "auto" }}
            />
          </Link>
        </div>

        <div className="hidden z-50 lg:ml-8 lg:flex lg:items-center lg:">
          <NavItem label="Routes" href="/routes" />
          <NavItem label="Payouts" href="/payouts" />
          <NavItem label="Settings" href="/settings/profile" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 ml-2">
          <div className="hidden lg:block">
            <CreateRouteDialog />
          </div>
          <NotificationInbox />
          <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
            <UserAccountNav />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
