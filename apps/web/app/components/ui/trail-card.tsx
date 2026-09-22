"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@repo/ui/lib/utils";

interface TrailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string;
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
      <motion.div
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
          "w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl bg-neutral-50 text-card-foreground dark:bg-neutral-900",
          className,
        )}
      >
        <div className="relative h-60 w-full">
          <img
            src={imageUrl}
            alt={origin}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-4">
            <div className="text-white">
              {originLabel ? (
                <p className="text-sm font-medium text-white/70">{originLabel}</p>
              ) : null}
              <h3 className="text-xl font-semibold">{origin}</h3>
            </div>
            {/* The button will animate in on hover of the parent card */}
            {/* <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileHover={{ opacity: 1, x: 0 }}
              animate={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Button
                variant="secondary"
                onClick={onDirectionsClick}
                aria-label={`Get directions to ${origin}`}
              >
                Directions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div> */}
          </div>
        </div>

        <div className="p-5">
          <div className="">
            {destinationLabel ? (
              <p className="text-sm font-medium text-muted-foreground">{destinationLabel}</p>
            ) : null}
<p className="font-semibold text-foreground">{destination}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{date}</span>
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
      </motion.div>
    );
  },
);

TrailCard.displayName = "TrailCard";

export { TrailCard };