"use client";

import React from "react";
import Image from "next/image";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import HowItWorks, {
    driverFeatures,
    passengerFeatures,
    type Audience,
} from "~/components/HowItWorks";

const AUDIENCE_OPTIONS = [
    { value: "passenger", label: "Passenger" },
    { value: "driver", label: "Driver" },
] as const;

export default function HowItWorksSection() {
    const [audience, setAudience] = React.useState<Audience>("passenger");

    return (
        <>
            <div className="grid grid-cols-1 justify-items-center gap-8 md:grid-cols-2 md:items-center md:gap-x-12">
                <ToggleGroup
                    value={[audience]}
                    onValueChange={(value) => {
                        const next = value[0];
                        if (next === "passenger" || next === "driver") {
                            setAudience(next);
                        }
                    }}
                    aria-label="Choose how Daily Express works for you"
                    className="order-3 flex w-fit rounded-full bg-neutral-100 p-1 md:order-1 md:col-span-2 md:col-start-1 md:row-start-1 md:justify-self-center"
                >
                    {AUDIENCE_OPTIONS.map((option) => (
                        <TogglePrimitive
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer rounded-full px-6 py-2 text-sm font-semibold text-neutral-500 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[pressed]:bg-neutral-900 data-[pressed]:text-white"
                        >
                            {option.label}
                        </TogglePrimitive>
                    ))}
                </ToggleGroup>

                <h2 className="order-2 text-center text-4xl font-bold tracking-tight md:order-2 md:col-start-1 md:row-start-2 md:justify-self-start md:text-left md:text-5xl">
                    How Daily Express Works
                </h2>
                <Image
                    src="/how-it-works.png"
                    alt=""
                    width={576}
                    height={747}
                    className="order-1 w-40 shrink-0 md:order-3 md:col-start-2 md:row-start-2 md:justify-self-end md:w-52"
                />
            </div>

            <HowItWorks
                features={
                    audience === "driver" ? driverFeatures : passengerFeatures
                }
                className="py-0 -mx-4 sm:-mx-6"
            />
        </>
    );
}
