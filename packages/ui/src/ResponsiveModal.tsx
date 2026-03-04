"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";
import type { ResponsiveModalProps } from "@repo/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";


/**
 * Renders a custom full-screen mobile panel (overlay + fixed div) on small
 * screens and a centred Dialog on desktop.
 * Returns `null` while `useIsMobile` resolves to prevent a flash on first paint.
 *
 * @example
 * ```tsx
 * <ResponsiveModal
 *   open={open}
 *   onOpenChange={setOpen}
 *   trigger={<Button>Open</Button>}
 *   title="My Modal"
 *   description="Some description."
 * >
 *   <MyForm />
 * </ResponsiveModal>
 * ```
 */
export function ResponsiveModal({
    open,
    onOpenChange,
    trigger,
    title,
    description,
    children,
    dialogClassName,
    panelClassName,
}: ResponsiveModalProps) {
    const isMobile = useIsMobile();

    // Lock body scroll when the mobile panel is open
    useEffect(() => {
        if (!isMobile) return;
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isMobile, open]);

    // Avoid a layout flash while the hook resolves
    if (isMobile === undefined) return null;

    if (isMobile) {
        return (
            <>
                {/* Trigger */}
                {trigger && (
                    <span onClick={() => onOpenChange?.(true)}>{trigger}</span>
                )}

                <AnimatePresence>
                    {open && (
                        <>
                            {/* Overlay */}
                            <motion.div
                                key="rm-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="fixed inset-0 z-50 bg-black/50"
                                onClick={() => onOpenChange?.(false)}
                            />

                            {/* Full-screen panel */}
                            <motion.div
                                key="rm-panel"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby={title ? "modal-title" : undefined}
                                tabIndex={-1}
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className={cn(
                                    "fixed inset-0 z-50 flex flex-col bg-background overflow-hidden",
                                    panelClassName
                                )}
                            >
                                {/* Header */}
                                {(title || description) && (
                                    <div className="p-4 border-b shrink-0">
                                        {title && (
                                            <h2 id="modal-title" className="text-xl font-semibold">
                                                {title}
                                            </h2>
                                        )}
                                        {description && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {description}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Scrollable body */}
                                <div className="flex-1 overflow-y-auto">
                                    {children}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // ── Desktop — Dialog ─────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent
                className={cn(
                    "max-w-[540px] max-h-[90vh] overflow-y-auto",
                    dialogClassName
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {(title || description) && (
                    <DialogHeader className="pb-4 border-b px-0">
                        {title && (
                            <DialogTitle className="text-xl font-semibold">
                                {title}
                            </DialogTitle>
                        )}
                        {description && (
                            <DialogDescription className="text-sm text-muted-foreground mt-1">
                                {description}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                )}
                {children}
            </DialogContent>
        </Dialog>
    );
}

ResponsiveModal.displayName = "ResponsiveModal";
