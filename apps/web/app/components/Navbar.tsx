import Link from 'next/link'
import { cookies } from 'next/headers'
// import UserAccountNav from './UserAccountNav'

import { Button, buttonVariants } from '@repo/ui/components/button'

import { BellIcon, CaretDownIcon, MapPinPlusIcon, PlusIcon } from '@phosphor-icons/react/dist/ssr'
import { Icons } from './Icons';
import NavItem from './NavItem';
import { UserAccountNav } from './UserAccountNav';

// import MobileNav from './MobileNav'

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
    const user = null

    return (
        <div className='bg-white sticky z-50 top-0 inset-x-0 h-16'>
            <header className='relative bg-gray-50'>
                <div className='mx-auto w-full max-w-7xl px-2.5 '>
                    <div className='flex h-16 items-center'>

                        <div className='flex'>
                            <Link href='/'>
                                <Icons.logo className='h-10 w-10' />
                            </Link>
                        </div>

                        <div className='ml-auto flex items-center'>
                            <div className='lg:flex lg:flex-1 lg:items-center lg:justify-end lg:space-x-6'>
                                {user ? null : (
                                    <div className='hidden lg:block'>
                                        <Link
                                            href='/sign-in'
                                            className={buttonVariants({
                                                variant: 'ghost',
                                            })}>
                                            Become a driver
                                        </Link>
                                    </div>
                                )}

                                {user ? null : (
                                    <span
                                        className='hidden lg:block h-6 w-px bg-gray-200'
                                        aria-hidden='true'
                                    />
                                )}

                                {user ? (
                                    <UserAccountNav />
                                ) : (
                                    <Link
                                        href='/sign-in'
                                        className={buttonVariants({
                                            variant: 'softBlue',
                                        })}>
                                        Sign in
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </div>

    )
}

export default Navbar