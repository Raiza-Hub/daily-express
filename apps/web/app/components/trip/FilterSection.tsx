export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="pb-5 mb-1">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">{title}</h3>
            </div>
            <div>{children}</div>
        </div>
    );
}
