import { cn } from "@repo/ui/lib/utils";

const Footer = async ({ className }: { className?: string } = {}) => {
    return (
        <div className="mt-12 border-t w-full">
            <div className={cn("px-4 py-4 flex flex-col items-center justify-between gap-4 text-center md:flex-row", className)}>
                <p className="text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Daily Express. All rights reserved.
                </p>
                <nav className="flex gap-4 text-sm">
                    <a href="#" className="transition-colors hover:text-primary">
                        Privacy Policy
                    </a>
                    <a href="#" className="transition-colors hover:text-primary">
                        Terms of Service
                    </a>
                    <a href="#" className="transition-colors hover:text-primary">
                        Cookie Settings
                    </a>
                </nav>
            </div>
        </div>
    )
}

export default Footer;
