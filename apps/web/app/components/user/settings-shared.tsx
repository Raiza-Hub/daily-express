function Row({
    label,
    required,
    description,
    isLast,
    children,
}: {
    label: string;
    required?: boolean;
    description?: string;
    isLast?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 ${
                isLast ? "" : "border-b border-border"
            }`}
        >
            <div>
                <p className="text-sm font-semibold text-foreground">
                    {label}
                    {required && <span className="ml-0.5 text-blue-500">*</span>}
                </p>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                {children}
            </div>
        </div>
    );
}

function EditLink({ children = "Edit", onClick }: { children?: string; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="cursor-pointer text-sm font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground"
        >
            {children}
        </button>
    );
}

function getInitials(name: string): string {
    const parts = name.split(" ").filter(Boolean);
    return (
        parts
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || "U"
    );
}

export { Row, EditLink, getInitials };
