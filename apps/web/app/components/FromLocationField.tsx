"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";
import { cn } from "@repo/ui/lib/utils";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { UNIVERSITIES } from "~/lib/universities";

const EMPTY_REFS: React.RefObject<HTMLDivElement | null>[] = [];

const UniversityList = ({
  id,
  value,
  onSelect,
}: {
  id: string;
  value: string;
  onSelect: (value: string) => void;
}) => {
  return (
    <RadioGroup className="gap-6" value={value} onValueChange={onSelect}>
      {UNIVERSITIES.map((university, index) => (
        <div key={university.label} className="flex items-start gap-2">
          <RadioGroupItem
            className="mt-1 shrink-0 text-blue-600"
            aria-describedby={`${id}-${index}-description`}
            id={`${id}-${index}`}
            value={university.label}
          />
          <div className="grid grow gap-1">
            <Label className="text-base" htmlFor={`${id}-${index}`}>
              {university.label}
            </Label>
            <p
              className="text-muted-foreground text-sm"
              id={`${id}-${index}-description`}
            >
              {university.description}
            </p>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
};

const FromLocationField = ({
  id,
  value,
  onChange,
  hideLabel = false,
  icon,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  icon?: ReactNode;
  className?: string;
}) => {
  const radioId = useId();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clickOutsideRefs = useMemo(
    () => (isMobile ? EMPTY_REFS : [containerRef]),
    [isMobile],
  );

  useClickOutside(clickOutsideRefs, () => setIsOpen(false));

  const select = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        hideLabel
          ? "relative flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5"
          : "relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition",
        className,
      )}
    >
      {hideLabel ? null : (
        <label htmlFor={id} className="text-xs text-neutral-400">
          Origin
        </label>
      )}

      {icon ? <span className="flex-none text-neutral-500">{icon}</span> : null}

      <Input
        id={id}
        value={value}
        placeholder="City or university"
        readOnly
        disabled={isMobile === undefined}
        autoComplete="off"
        className={cn(
          "border-0 p-0 h-auto text-sm font-medium bg-transparent shadow-none focus-visible:ring-0 rounded-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
          hideLabel && "flex-1 line-clamp-1 sm:line-clamp-none",
        )}
        onClick={() => setIsOpen(true)}
      />

      {!isMobile && isOpen ? (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-neutral-200 rounded-2xl shadow-lg p-4 max-h-80 overflow-y-auto">
          <UniversityList id={radioId} value={value} onSelect={select} />
        </div>
      ) : null}

      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="w-full max-h-[80vh]">
            <DrawerHeader>
              <DrawerTitle>Select university</DrawerTitle>
              <DrawerDescription>
                Choose where you&apos;re departing from.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto">
              <UniversityList id={radioId} value={value} onSelect={select} />
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
};

export default FromLocationField;
