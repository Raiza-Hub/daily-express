"use client";

import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

interface TrailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl?: string;
  origin: string;
  originLabel?: string;
  destination: string;
  destinationLabel?: string;
  date: string;
  departureTime: string;
  fare: string;
  onClick?: () => void;
  onDirectionsClick?: () => void;
}

const TrailCard = React.forwardRef<HTMLDivElement, TrailCardProps>(
  (
    {
      className,
      imageUrl,
      origin,
      originLabel,
      destination,
      destinationLabel,
      date,
      departureTime,
      fare,
      onClick,
      // onDirectionsClick,
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (
            onClick &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "flex w-full flex-col cursor-pointer overflow-hidden rounded-2xl bg-neutral-50 text-card-foreground xl:max-w-sm dark:bg-neutral-900",
          className,
        )}
      >
        <div className="relative h-60 w-full shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={origin}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              role="presentation"
              className="h-full w-full bg-gradient-to-br from-neutral-300 to-neutral-500 dark:from-neutral-800 dark:to-neutral-950"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-4">
            <div className="text-white">
              {originLabel ? (
                <p className="text-sm font-medium text-white/70">{originLabel}</p>
              ) : null}
              <h3 className="text-xl font-bold">{origin}</h3>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="grow">
            {destinationLabel ? (
              <p className="text-sm font-medium text-muted-foreground">{destinationLabel}</p>
            ) : null}
            <p className="font-bold text-foreground">{destination}</p>
            <p className="text-sm font-medium text-muted-foreground">
              {date}
              {" \u2022 "}
              {departureTime}
            </p>
          </div>
          <div className="my-4 h-px w-full bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Price
            </span>
            <span className="text-lg font-bold text-foreground">{fare}</span>
          </div>
        </div>
      </div>
    );
  },
);

TrailCard.displayName = "TrailCard";

export { TrailCard };