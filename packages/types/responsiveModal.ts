import type { ReactNode } from "react";

export interface ResponsiveModalProps {
    /** Controlled open state */
    open?: boolean;
    /** Called when the open state should change */
    onOpenChange?: (open: boolean) => void;
    /** The element that opens the modal when clicked */
    trigger?: ReactNode;
    /** Modal heading */
    title?: ReactNode;
    /** Optional subtitle / description */
    description?: ReactNode;
    /** Modal body content */
    children?: ReactNode;
    /** Extra class names applied to the DialogContent wrapper (desktop only) */
    dialogClassName?: string;
    /** Extra class names applied to the mobile panel wrapper */
    panelClassName?: string;
}
