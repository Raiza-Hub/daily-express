/* eslint-disable @next/next/no-img-element */
"use client";

import { MapPinAreaIcon } from "@phosphor-icons/react";
import type { TRoute } from "@repo/types/routeSchema";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import dayjs from "dayjs";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useMeasure } from "react-use";
import { BookingContext } from "~/lib/type";
import { parseLocalDate, parseTimeString } from "~/lib/utils";
import { DriverInfo, DriverInfoProps } from "../DriverInfo";

const TAB_ORDER = ["trip", "driver"] as const;

const panelVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
  }),
};

interface TripDetailsSheetProps {
  trip: TRoute;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingContext?: BookingContext;
  paymentStatus?: string;
  showDriverDetails?: boolean;
  driver?: DriverInfoProps;
  displayMessage?: string | null;
  driverStatus?: string;
}

const TripDetailsSheet = ({
  trip,
  open,
  onOpenChange,
  bookingContext,
  paymentStatus,
  showDriverDetails,
  driver,
  displayMessage,
  driverStatus,
}: TripDetailsSheetProps) => {
  const [activeTab, setActiveTab] = useState("trip");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef("trip");
  const [measureRef, { height: contentHeight }] = useMeasure<HTMLDivElement>();

  const timeBaseDate = bookingContext
    ? parseLocalDate(bookingContext.tripDate)
    : new Date();

  const depTime = parseTimeString(trip.departureTime, timeBaseDate);
  const arrTime = parseTimeString(trip.estimatedArrivalTime, timeBaseDate);

  const selectedTripDate = bookingContext
    ? parseLocalDate(bookingContext.tripDate)
    : depTime;
  const scheduledDepartureTime = depTime;
  let scheduledArrivalTime = arrTime;

  if (scheduledArrivalTime <= scheduledDepartureTime) {
    scheduledArrivalTime = dayjs(scheduledArrivalTime).add(1, "day").toDate();
  }

  const departureTime = dayjs(scheduledDepartureTime).format("h:mma");
  const arrivalTime = dayjs(scheduledArrivalTime).format("h:mma");
  const departureDate = dayjs(scheduledDepartureTime).format("ddd, D MMM YYYY");
  const bookingDate = bookingContext
    ? dayjs(selectedTripDate).format("ddd, D MMM YYYY")
    : departureDate;

  const showDriverTab =
    Boolean(showDriverDetails) &&
    paymentStatus !== "refunded" &&
    paymentStatus !== "refund_failed";

  // Derived directly during render — no effect needed
  const currentTab = showDriverTab ? activeTab : "trip";

  // Direction: 1 = moving right (trip -> driver), -1 = moving left (driver -> trip)
  const direction =
    TAB_ORDER.indexOf(currentTab as (typeof TAB_ORDER)[number]) >
      TAB_ORDER.indexOf(prevTabRef.current as (typeof TAB_ORDER)[number])
      ? 1
      : -1;

  // Reset scroll position whenever the tab changes so a tall→short swap
  // (or vice versa) doesn't leave the new panel scrolled to a stale offset.
  // Also record the tab we're leaving so the next switch knows its direction.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
    prevTabRef.current = currentTab;
  }, [currentTab]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-full p-0 flex flex-col max-h-[90vh]"
      >
        <div className="relative w-full max-w-md mx-auto flex flex-col flex-1 min-h-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Trip details</DrawerTitle>
            <DrawerDescription>
              Trip from {trip.departureCity.title} to {trip.arrivalCity.title}
            </DrawerDescription>
          </DrawerHeader>

          {(paymentStatus === "refunded" ||
            paymentStatus === "refund_failed") &&
            currentTab === "trip" ? (
            <img
              src={
                paymentStatus === "refunded"
                  ? "/refund-stamp.png"
                  : "/refund-fail-stamp.png"
              }
              alt=""
              className="absolute right-2 top-14 w-20 h-20 sm:-right-16 sm:top-16 sm:w-32 sm:h-32 object-contain pointer-events-none select-none z-10"
            />
          ) : null}

          <Tabs
            defaultValue="trip"
            value={currentTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 min-h-0 pt-3"
          >
            <TabsList
              variant="line"
              className="w-full rounded-none border-b shrink-0"
            >
              <TabsTrigger
                value="trip"
                className="cursor-pointer after:bg-neutral-100"
              >
                Trip details
              </TabsTrigger>
              {showDriverTab ? (
                <TabsTrigger
                  value="driver"
                  className="cursor-pointer after:bg-neutral-100"
                >
                  Driver details
                </TabsTrigger>
              ) : null}
            </TabsList>

            {/* ref is used to reset scroll position on tab change */}
            <div
              ref={scrollContainerRef}
              className="relative flex-1 overflow-y-auto mt-0 pb-3"
            >
              {/*
                This wrapper animates its height to match whatever useMeasure
                reports for the inner content div, so the drawer resizes
                smoothly between the (taller) trip panel and the (shorter)
                driver panel instead of snapping instantly.
              */}
              <motion.div
                animate={{ height: contentHeight || "auto" }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div ref={measureRef}>
                  {/*
                    Single keyed child + mode="wait": the current panel fades/slides
                    out, then the next one fades/slides in from the correct side.
                    custom={direction} feeds the variants below so the slide axis
                    flips depending on whether we're moving toward "driver" or
                    back toward "trip".
                  */}
                  <AnimatePresence
                    mode="wait"
                    initial={false}
                    custom={direction}
                  >
                    {currentTab === "trip" ? (
                      <motion.div
                        key="trip"
                        custom={direction}
                        variants={panelVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                      >
                        <div className="px-6 pt-3 pb-5 space-y-1">
                          <h2 className="text-lg font-bold text-neutral-900">
                            {trip.departureCity.title} to{" "}
                            {trip.arrivalCity.title}
                          </h2>
                          <p className="text-sm text-neutral-500">
                            {bookingDate}
                          </p>
                        </div>

                        <div className="px-6 pb-2">
                          <div className="flex gap-4">
                            <div className="shrink-0 w-14 flex justify-end items-start">
                              <span className="text-sm font-medium text-neutral-800 select-none leading-none">
                                {departureTime}
                              </span>
                            </div>
                            <div className="relative shrink-0 w-5 flex flex-col items-center">
                              <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0" />
                              <div className="flex-1 w-px bg-neutral-300" />
                            </div>
                            <div className="flex-1 flex flex-col pb-5">
                              <p className="font-semibold text-md text-neutral-900 leading-none">
                                {trip.departureCity.title}
                              </p>
                              <p className="text-sm text-neutral-500 mt-1">
                                {trip.departureCity.label}(
                                {trip.departureCity.locality})
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="shrink-0 w-14" />
                            <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[90px]">
                              <div className="w-px bg-neutral-300 flex-1" />
                              <div className="relative z-10 bg-white py-1 shrink-0">
                                <MapPinAreaIcon
                                  weight="duotone"
                                  size={20}
                                  className="text-neutral-500"
                                />
                              </div>
                              <div className="w-px bg-neutral-300 flex-1" />
                            </div>
                            <div className="flex-1 flex items-center py-4">
                              <p className="text-sm font-medium text-neutral-900">
                                {trip.meetingPoint} to board vehicle
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="shrink-0 w-14 flex justify-end items-end">
                              <span className="text-sm font-medium text-neutral-800 select-none leading-none">
                                {arrivalTime}
                              </span>
                            </div>
                            <div className="relative shrink-0 w-5 flex flex-col items-center">
                              <div className="w-px bg-neutral-300 flex-1" />
                              <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0" />
                            </div>
                            <div className="flex-1 flex flex-col justify-end pt-5">
                              <p className="font-semibold text-md text-neutral-900 leading-none">
                                {trip.arrivalCity.title}
                              </p>
                              <p className="text-sm text-neutral-500 mt-1">
                                {trip.arrivalCity.label}(
                                {trip.arrivalCity.locality})
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="driver"
                        custom={direction}
                        variants={panelVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                      >
                        <div className="px-6 pt-5 pb-6">
                          {driver ? (
                            <DriverInfo {...driver} />
                          ) : (
                            <div className="flex flex-col items-center text-center gap-3">
                              <img
                                src={
                                  driverStatus === "overdue"
                                    ? "/driver-not-found.webp"
                                    : "/awaiting-driver.webp"
                                }
                                alt=""
                                className="h-60 w-84 object-center"
                              />
                              <p className="text-sm text-neutral-600">
                                {displayMessage}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default TripDetailsSheet;