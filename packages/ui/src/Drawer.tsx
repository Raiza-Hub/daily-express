"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@repo/ui/lib/utils"

const Drawer = ({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
    <DrawerPrimitive.Root data-slot="drawer" {...props} />
)
Drawer.displayName = "Drawer"

const DrawerPortal: React.FC<React.PropsWithChildren<{ container?: HTMLElement }>> = ({
    container,
    children,
}) => <DrawerPrimitive.Portal container={container}>{children}</DrawerPrimitive.Portal>

const DrawerTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }
>((props, ref) => <DrawerPrimitive.Trigger ref={ref} {...props} />)
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerClose = React.forwardRef<
    HTMLButtonElement,
    React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }
>((props, ref) => <DrawerPrimitive.Close ref={ref} {...props} />)
DrawerClose.displayName = "DrawerClose"

const DrawerOverlay = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Overlay
        ref={ref}
        data-slot="drawer-overlay"
        className={cn("fixed inset-0 z-50 bg-black/80", className)}
        {...props}
    />
))
DrawerOverlay.displayName = "DrawerOverlay"

const DrawerContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div">
>(({ className, children, ...props }, ref) => (
    <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
            ref={ref}
            data-slot="drawer-content"
            className={cn(
                "group/drawer-content bg-background fixed z-50 flex h-auto flex-col",
                "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-[var(--radius-lg)]",
                "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-[var(--radius-lg)]",
                "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:max-w-sm",
                "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:max-w-sm",
                className,
            )}
            {...props}
        >
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:mt-0 group-data-[vaul-drawer-direction=right]/drawer-content:rotate-90 group-data-[vaul-drawer-direction=left]/drawer-content:rotate-90" />
            {children}
        </DrawerPrimitive.Content>
    </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div
        data-slot="drawer-header"
        className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
        {...props}
    />
)

const DrawerFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div
        data-slot="drawer-footer"
        className={cn("mt-auto flex flex-row flex-wrap items-center justify-center gap-2 p-6", className)}
        {...props}
    />
)

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<"h2">>(
    ({ className, ...props }, ref) => (
        <DrawerPrimitive.Title
            ref={ref}
            data-slot="drawer-title"
            className={cn("text-foreground text-lg font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    ),
)
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<
    HTMLParagraphElement,
    React.ComponentPropsWithoutRef<"p">
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description
        ref={ref}
        data-slot="drawer-description"
        className={cn("text-muted-foreground text-sm", className)}
        {...props}
    />
))
DrawerDescription.displayName = "DrawerDescription"

export {
    Drawer,
    DrawerPortal,
    DrawerOverlay,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
}