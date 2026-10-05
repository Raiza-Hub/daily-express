"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  CalendarDays,
  Car,
  HelpCircle,
  Info,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Sparkles,
  UserIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/ui/Drawer";
import { useGetMe } from "@repo/api";
import type { User } from "@shared/types";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "~/components/ui/button";
import { getInitials } from "~/components/user/settings-shared";
import { useSignOut } from "~/lib/use-sign-out";
import {
  APP_NAV_LINKS,
  DRIVER_CALENDAR_HREF,
  MARKETING_NAV_LINKS,
  driverCtaClassName,
  signInClassName,
  type NavIconName,
  type NavLink,
} from "~/components/navbar-links";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  car: Car,
  calendarDays: CalendarDays,
  mapPin: MapPin,
  settings: Settings,
  sparkles: Sparkles,
  info: Info,
  helpCircle: HelpCircle,
};

const desktopLinkClassName =
  "relative rounded-full px-3 py-2 text-sm font-medium text-foreground";

const pillTransition = (prefersReducedMotion: boolean | null): Transition =>
  prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 380, damping: 32, mass: 0.6 };

const drawerLinkClassName = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
    active
      ? "bg-accent text-foreground"
      : "text-foreground hover:bg-accent hover:text-foreground",
  );

const linkKey = (link: NavLink) => `${link.href}#${link.label}`;

const groupLabelClassName =
  "px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function Avatar({
  name,
  src,
  pending = false,
  className,
}: {
  name: string;
  src?: string | null;
  pending?: boolean;
  className?: string;
}) {
  if (pending) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "block h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-200",
          className,
        )}
      />
    );
  }

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={40}
        height={40}
        className={cn(
          "h-10 w-10 shrink-0 rounded-full object-cover",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white",
        className,
      )}
    >
      {name ? (
        <span className="text-xs font-semibold">{getInitials(name)}</span>
      ) : (
        <UserIcon className="h-4 w-4" />
      )}
    </span>
  );
}

type PillBounds = { x: number; y: number; width: number; height: number };

/* `instant` marks the first non-null placement. The pill mounts with a zero-size
   box, and by then `initial={false}` no longer applies, so without this the very
   first placement would animate outward from the list's origin. */
type PillState = { bounds: PillBounds | null; instant: boolean };

function isLinkVisible(link: NavLink, showDriverLink: boolean): boolean {
  return link.href !== DRIVER_CALENDAR_HREF || showDriverLink;
}

function isDesktopLinkActive(link: NavLink, pathname: string): boolean {
  return (
    pathname === link.href ||
    (link.href === "/settings/profile" && pathname.startsWith("/settings/"))
  );
}

function DesktopLinks({
  links,
  showDriverLink,
  pathname,
  prefersReducedMotion,
}: {
  links: readonly NavLink[];
  showDriverLink: boolean;
  pathname: string;
  prefersReducedMotion: boolean | null;
}) {
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const linkRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const [pill, setPill] = React.useState<PillState | null>(null);
  const hasPlacedPill = React.useRef(false);

  /* Keyed by linkKey, not href: "About Us" and "FAQ" deliberately share
       /#faq, and matching on href would pick the wrong link for the pill. */
  const activeLink = links.find(
    (link) => isDesktopLinkActive(link, pathname) && isLinkVisible(link, showDriverLink),
  );
  const highlightedKey = hoveredKey ?? (activeLink && linkKey(activeLink));

  const measureLink = React.useCallback((key: string | null) => {
    if (!key || !listRef.current) {
      return null;
    }

    const link = linkRefs.current.get(key);

    if (!link) {
      return null;
    }

    const listRect = listRef.current.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    return {
      x: linkRect.left - listRect.left,
      y: linkRect.top - listRect.top,
      width: linkRect.width,
      height: linkRect.height,
    };
  }, []);

  const updatePillBounds = React.useCallback(() => {
    const bounds = measureLink(highlightedKey ?? null);
    const instant = bounds !== null && !hasPlacedPill.current;

    if (bounds !== null) {
      hasPlacedPill.current = true;
    }

    setPill({ bounds, instant });
  }, [highlightedKey, measureLink]);

  const setLinkRef = React.useCallback(
    (key: string, node: HTMLAnchorElement | null) => {
      if (node) {
        linkRefs.current.set(key, node);
      } else {
        linkRefs.current.delete(key);
      }
    },
    [],
  );

  React.useLayoutEffect(() => {
    updatePillBounds();
  }, [updatePillBounds]);

  React.useEffect(() => {
    if (!highlightedKey) {
      return;
    }

    const list = listRef.current;
    const link = linkRefs.current.get(highlightedKey);

    if (!list || !link || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePillBounds);

      return () => window.removeEventListener("resize", updatePillBounds);
    }

    const observer = new ResizeObserver(updatePillBounds);
    observer.observe(list);
    observer.observe(link);

    return () => observer.disconnect();
  }, [highlightedKey, updatePillBounds]);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.ul
        ref={listRef}
        className="relative ml-10 hidden items-center gap-1 lg:flex"
        onPointerLeave={() => setHoveredKey(null)}
      >
        <m.li
          aria-hidden="true"
          initial={false}
          animate={
            pill?.bounds
              ? {
                  opacity: 1,
                  x: pill.bounds.x,
                  y: pill.bounds.y,
                  width: pill.bounds.width,
                  height: pill.bounds.height,
                }
              : {
                  opacity: 0,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                }
          }
          transition={
            pill?.instant ? { duration: 0 } : pillTransition(prefersReducedMotion)
          }
          style={{ borderRadius: "9999px" }}
          className="pointer-events-none absolute left-0 top-0 z-0 bg-accent"
        />
        {links.map((link) => {
          const visible = isLinkVisible(link, showDriverLink);
          const active = visible && isDesktopLinkActive(link, pathname);
          const key = linkKey(link);

          return (
            <li
              key={key}
              aria-hidden={visible ? undefined : true}
              className={cn(
                "relative z-10",
                !visible && "invisible pointer-events-none",
              )}
            >
              <Link
                ref={(node) => setLinkRef(key, node)}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onPointerEnter={() => setHoveredKey(key)}
                className={desktopLinkClassName}
              >
                <span className="relative z-10">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </m.ul>
    </LazyMotion>
  );
}

function LinkList({
  links,
  pathname,
  onNavigate,
}: {
  links: readonly NavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = NAV_ICONS[link.icon];
        const active = pathname === link.href;

        return (
          <li key={linkKey(link)}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={drawerLinkClassName(active)}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PanelHeader({ user, name }: { user: User | null; name: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-border px-4">
      {user ? (
        <Avatar
          name={name}
          src={user.profilePictureUrl}
          className="h-11 w-11 text-sm"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        {user ? (
          <>
            <DrawerTitle className="sr-only">Menu</DrawerTitle>
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </>
        ) : (
          <DrawerTitle className="text-base">Menu</DrawerTitle>
        )}
      </div>

      <DrawerClose asChild>
        <Button variant="ghost" size="sm" pill className="h-9 w-9 shrink-0 p-0">
          <X aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Close menu</span>
        </Button>
      </DrawerClose>
    </div>
  );
}

function DrawerSections({
  hasSession,
  appLinks,
  pathname,
  onNavigate,
}: {
  hasSession: boolean;
  appLinks: readonly NavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
      {hasSession ? (
        <p className={groupLabelClassName}>Trip &amp; account</p>
      ) : null}

      <LinkList
        links={hasSession ? appLinks : MARKETING_NAV_LINKS}
        pathname={pathname}
        onNavigate={onNavigate}
      />

      {hasSession ? (
        <>
          <p
            className={cn(
              groupLabelClassName,
              "mt-3 border-t border-border pt-3",
            )}
          >
            Explore
          </p>
          <LinkList
            links={MARKETING_NAV_LINKS}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </>
      ) : null}
    </nav>
  );
}

interface NavbarNavProps {
  hasSession: boolean;
  showDriverCta: boolean;
  showDriverLink: boolean;
}

export function NavbarNav({
  hasSession,
  showDriverCta,
  showDriverLink,
}: NavbarNavProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = React.useState(false);
  const signOut = useSignOut({ onSuccess: () => setIsOpen(false) });

  const { data: user, isPending } = useGetMe({ enabled: hasSession });

  const name = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "";

  const desktopLinks = hasSession ? APP_NAV_LINKS : MARKETING_NAV_LINKS;
  const drawerAppLinks = desktopLinks.filter((link) =>
    isLinkVisible(link, showDriverLink),
  );
  const close = () => setIsOpen(false);

  const iconTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: "easeOut" as const };

  return (
    <>
      <DesktopLinks
        links={desktopLinks}
        showDriverLink={showDriverLink}
        pathname={pathname}
        prefersReducedMotion={prefersReducedMotion}
      />

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/driver/signup"
            aria-hidden={showDriverCta ? undefined : true}
            tabIndex={showDriverCta ? undefined : -1}
            className={cn(
              driverCtaClassName,
              !showDriverCta && "invisible pointer-events-none",
            )}
          >
            Become a driver
          </Link>

          {hasSession ? (
            <span title={name} className="flex items-center">
              <Avatar
                name={name}
                src={user?.profilePictureUrl}
                pending={isPending}
                className="h-9 w-9"
              />
            </span>
          ) : (
            <Link href="/login" className={signInClassName}>
              Sign in
            </Link>
          )}
        </div>

        <Drawer direction="right" open={isOpen} onOpenChange={setIsOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              pill
              className="h-10 w-10 p-0 lg:hidden"
            >
              <LazyMotion features={domAnimation} strict>
                <AnimatePresence initial={false} mode="wait">
                  <m.span
                    key={isOpen ? "close" : "open"}
                    initial={{
                      opacity: 0,
                      rotate: -90,
                      scale: 0.8,
                    }}
                    animate={{
                      opacity: 1,
                      rotate: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      rotate: 90,
                      scale: 0.8,
                    }}
                    transition={iconTransition}
                    className="flex items-center justify-center"
                  >
                    {isOpen ? (
                      <X aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Menu aria-hidden="true" className="h-4 w-4" />
                    )}
                  </m.span>
                </AnimatePresence>
              </LazyMotion>
              <span className="sr-only">
                {isOpen ? "Close menu" : "Open menu"}
              </span>
            </Button>
          </DrawerTrigger>

          <DrawerContent className="p-0 [&>div:first-child]:hidden">
            <PanelHeader user={user ?? null} name={name} />

            <DrawerSections
              hasSession={hasSession}
              appLinks={drawerAppLinks}
              pathname={pathname}
              onNavigate={close}
            />

            <div className="flex flex-col gap-3 px-4 py-4">
              {showDriverCta ? (
                <Link href="/driver/signup" className={driverCtaClassName}>
                  Become a driver
                </Link>
              ) : null}

              {hasSession ? (
                <Button
                  type="button"
                  pill
                  onClick={signOut.signOut}
                  disabled={signOut.isPending}
                  className="w-full bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Sign out
                </Button>
              ) : (
                <Link href="/login" className={signInClassName} onClick={close}>
                  Sign in
                </Link>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
