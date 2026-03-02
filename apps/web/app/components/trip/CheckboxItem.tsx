import { Checkbox } from "@repo/ui/components/checkbox";

interface FilterItem {
    label: string;
    count?: number;
    price?: string;
}

export interface CheckboxItemProps extends FilterItem {
    checked: boolean;
    onChange: () => void;
}

export function CheckboxItem({ label, count, price, checked, onChange }: CheckboxItemProps) {
    return (
        <label className="flex items-center justify-between py-2 cursor-pointer group">
            <div className="flex items-center gap-3">
                <Checkbox
                    checked={checked}
                    onCheckedChange={onChange}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-sm group-hover:text-slate-900 transition-colors">
                    {label}
                    {count !== undefined && (
                        <span className="ml-1">({count})</span>
                    )}
                </span>
            </div>
        </label>
    );
}
