import { SpinnerIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@repo/ui/lib/utils";

type LoaderProps = {
    className?: string;
    iconClassName?: string;
    text?: string;
};

export default function Loader({
    className,
    iconClassName,
    text = "Loading...",
}: LoaderProps) {
    return (
        <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
            <SpinnerIcon
                className={cn("h-6 w-6 animate-spin", iconClassName)}
            />
            {text && <span>{text}</span>}
        </div>
    );
}