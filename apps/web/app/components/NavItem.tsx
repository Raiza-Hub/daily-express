import Link from 'next/link'
import { cn } from '@repo/ui/lib/utils'

interface NavItemProps {
    label: string
    href: string
    className?: string
}

const NavItem = ({ label, href, className }: NavItemProps) => {
    return (
        <Link
            href={href}
            className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                'hover:text-foreground hover:bg-muted rounded-md',
                className
            )}
        >
            {label}
        </Link>
    )
}

export default NavItem
