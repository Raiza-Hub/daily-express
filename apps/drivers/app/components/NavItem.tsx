import Link from 'next/link'
import { cn } from '@repo/ui/lib/utils'

interface NavItemProps {
    label: string
    href: string
    className?: string
    onClick?: () => void
}

const NavItem = ({ label, href, className, onClick }: NavItemProps) => {
    return (
        <Link
            href={href}
            onClick={onClick}
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
