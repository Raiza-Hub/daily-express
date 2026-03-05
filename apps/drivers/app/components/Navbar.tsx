import Link from 'next/link'
import { cookies } from 'next/headers'
// import UserAccountNav from './UserAccountNav'

import { Button, buttonVariants } from '@repo/ui/components/button'
import NavItem from './NavItem'
import { BellIcon, CaretDownIcon, MapPinPlusIcon, PlusIcon } from '@phosphor-icons/react/dist/ssr'
import NotificationInbox from './NotificationInbox'
import { UserAccountNav } from './UserAccountNav'
import CreateRouteDialog from './CreateRouteDialog'
import { Icons } from '@repo/ui/Icons'
import Image from 'next/image'
import MobileNav from './MobileNav'

const user = {
    id: "usr_9f8a7b6c",
    firstName: "Daniel",
    lastName: "Okafor",
    email: "daniel.okafor24@example.com",
    profilePictureUrl: "https://i.pravatar.cc/150?img=12",
    createdAt: "2024-05-12T10:24:00Z",
};

const Navbar = async () => {
    // const nextCookies = cookies()
    // const { user } = await getServerSideUser(nextCookies)
    const user = "wisdom"

    return (
        <div className="w-full flex items-center justify-between h-16 px-2.5 md:p-6 border-b border-neutral-200 ">
            <div className='flex h-16 items-center gap-3'>
                <MobileNav />

                <div className='flex'>
                    <Link href='/'>
                        <Image
                            src="/logo2.png"
                            alt="Logo"
                            width={40}
                            height={40}
                            className='object-contain object-center'
                        />
                    </Link>
                </div>

                <div className='hidden z-50 lg:ml-8 lg:flex lg:items-center lg:'>
                    <NavItem label="Payouts" href="/payouts" />
                    <NavItem label="Settings" href="/settings/profile" />
                </div>

                {/* <div className='ml-auto flex items-center'>
                    <div className='hidden lg:flex lg:flex-1 lg:items-center lg:justify-end lg:space-x-6'>

                        {user && (
                            // <UserAccountNav user={user} />
                            <div>hey</div>
                        )}
                    </div>
                </div> */}
            </div>

            <div className="flex items-center gap-6">
                {/* Icons */}
                <div className="flex items-center gap-4 ml-2">
                    <div className='hidden lg:block'>
                        <CreateRouteDialog />
                    </div>
                    <NotificationInbox />
                    <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                        {user && (
                            // <UserAccountNav user={user} />
                            <UserAccountNav />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Navbar