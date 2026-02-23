


const Footer = async () => {
    return (
        <div className="mt-12 border-t">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col items-center justify-between gap-4 text-center md:flex-row">
                <p className="text-sm text-muted-foreground">
                    © 2024 Daily Express. All rights reserved.
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