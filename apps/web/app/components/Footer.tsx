export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-neutral-100 bg-white px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-5">
                <p className="text-sm text-neutral-500">© {year} Daily Express, Inc.</p>
                <ul className="flex items-center gap-6">
                    <li>
                        <a
                            href="/terms"
                            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
                        >
                            Terms of Use
                        </a>
                    </li>
                    <li>
                        <a
                            href="/privacy"
                            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
                        >
                            Privacy Policy
                        </a>
                    </li>
                    <li>
                        <a
                            href="mailto:help@beckon.taxi"
                            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
                        >
                            help@beckon.taxi
                        </a>
                    </li>
                </ul>
            </div>
        </footer>
    );
}