"use client";

import React from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

interface CardProps {
    number: string;
    title: string;
    description: string;
    colorTheme?: "orange" | "blue" | "purple";
    className?: string;
    rotate?: string;
    colors?: {
        bg: string;
        text: string;
        border: string;
    };
}

const Pin = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M16 3a1 1 0 0 1 .117 1.993l-.117 .007v4.764l1.894 3.789a1 1 0 0 1 .1.331l.006 .116v2a1 1 0 0 1 -.883.993l-.117 .007h-4v4a1 1 0 0 1 -1.993.117l-.007 -.117v-4h-4a1 1 0 0 1 -.993 -.883l-.007 -.117v-2a1 1 0 0 1 .06 -.34l.046 -.107l1.894 -3.791v-4.762a1 1 0 0 1 -.117 -1.993l.117 -.007h8z" />
    </svg>
);

const Card = ({
    number,
    title,
    description,
    colorTheme = "blue",
    className,
    rotate,
    colors: customColors,
}: CardProps) => {
    const defaultBgColors = {
        orange: "bg-orange-50",
        blue: "bg-blue-50",
        purple: "bg-purple-50",
    };
    const defaultTextColors = {
        orange: "text-orange-500",
        blue: "text-blue-600",
        purple: "text-purple-600",
    };
    const defaultBorderColors = {
        orange: "border-orange-100",
        blue: "border-blue-100",
        purple: "border-purple-100",
    };

    const bgColor = customColors?.bg || defaultBgColors[colorTheme];
    const textColor = customColors?.text || defaultTextColors[colorTheme];
    const borderColor = customColors?.border || defaultBorderColors[colorTheme];

    return (
        <div
            className={cn(
                "relative w-full md:w-[280px] transition-transform duration-300 hover:z-30 hover:scale-105",
                rotate,
                className,
            )}
        >
            <div className="bg-white p-2 rounded-[25px] shadow-[0px_10px_20px_0px_#D3D3D3] border border-neutral-100">
                <Pin className={cn("w-8 h-8 z-20 mb-6 mx-auto", textColor)} />
                <div
                    className={cn(bgColor, "border", borderColor, "rounded-[15px] p-[15px] h-full flex flex-col relative overflow-hidden")}
                >
                    <span
                        className={cn(textColor, "text-4xl font-handwriting mb-5")}
                        style={{
                            fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
                        }}
                    >
                        {number}
                    </span>
                    <h3 className="text-2xl font-semibold text-neutral-800 leading-none mb-[10px]">
                        {title}
                    </h3>
                    <p className="text-neutral-500 text-sm/5 tracking-tight">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
};

export interface Step {
    title: string;
    description: string;
    colorTheme?: "orange" | "blue" | "purple";
    colors?: {
        bg: string;
        text: string;
        border: string;
    };
}

export interface StepPosition {
    className?: string;
    rotate?: string;
}

export interface HowItWorksProps {
    features?: Step[];
    className?: string;
    stepPositions?: StepPosition[];
}

export type Audience = "passenger" | "driver";

const DEFAULT_CARD_POSITIONS: StepPosition[] = [
    { className: "md:absolute md:top-0 md:left-[15%]", rotate: "rotate-8" },
    {
        className: "md:absolute md:top-[120px] md:right-[15%]",
        rotate: "-rotate-8",
    },
    { className: "md:absolute md:top-[450px] md:left-[15%]", rotate: "rotate-8" },
    {
        className: "md:absolute md:top-[570px] md:right-[10%]",
        rotate: "-rotate-8",
    },
    { className: "md:absolute md:top-[850px] md:left-[15%]", rotate: "rotate-8" },
];

export const passengerFeatures: Step[] = [
    {
        title: "Create Account",
        description:
            "Sign up in seconds with your email and a verified profile. That's all we need to get you moving.",
        colorTheme: "orange",
    },
    {
        title: "Choose Your Route",
        description:
            "Pick your pickup point, destination and departure date. You'll see every available slot and fare upfront.",
        colorTheme: "blue",
    },
    {
        title: "Book & Pay",
        description:
            "Add the passengers travelling and pay. You book the whole vehicle, so the total is fixed before you confirm, with nothing added later.",
        colorTheme: "purple",
    },
    {
        title: "We Find Your Driver",
        description:
            "We verify every driver's identity before they can take a trip, then start looking once your booking is paid.",
        colorTheme: "orange",
    },
    {
        title: "Go, or Get Refunded",
        description:
            "The ride only leaves once a driver is confirmed. If none is, your fare comes back automatically.",
        colorTheme: "blue",
    },
];

export const driverFeatures: Step[] = [
    {
        title: "Create Your Account",
        description:
            "Sign up with your email and build your driver profile in minutes.",
        colorTheme: "orange",
    },
    {
        title: "Get Verified",
        description:
            "Complete identity and bank verification to start taking trips.",
        colorTheme: "blue",
    },
    {
        title: "Accept Trip Offers",
        description:
            "We call you when a trip near you needs a driver. Press 1 to accept, 2 to decline.",
        colorTheme: "purple",
    },
    {
        title: "Drive & Complete",
        description:
            "Pick up your passengers and complete the trip when you arrive.",
        colorTheme: "orange",
    },
    {
        title: "Get Paid",
        description:
            "Your earnings are paid straight to your verified bank account.",
        colorTheme: "blue",
    },
];

export default function HowItWorks({
    features,
    className,
    stepPositions,
}: HowItWorksProps) {
    const data =
        features && features.length > 0 ? features : passengerFeatures;
    const positions = stepPositions || DEFAULT_CARD_POSITIONS;

    let height: number;
    if (data.length === 1) height = 400;
    else if (data.length === 2) height = 450;
    else if (data.length === 3) height = 800;
    else if (data.length === 4) height = 900;
    else height = 1130;

    return (
        <LazyMotion features={domAnimation}>
            <div
                className={cn("max-md:pt-10 max-md:pb-25 md:py-20 px-8 relative", className)}
            >
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.08]"
                    style={{
                        backgroundImage: "linear-gradient(#000 1px, transparent 1px)",
                        backgroundSize: "100% 32px",
                        marginTop: "4px",
                    }}
                ></div>
                <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r"></div>
                <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l"></div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div
                        className="relative w-full max-w-[1000px] mx-auto flex flex-col space-y-8 md:space-y-0 md:block h-auto md:h-[var(--md-height)]"
                        style={{ "--md-height": `${height}px` } as React.CSSProperties}
                    >
                        {data.length > 1 && (
                            <svg
                                className="absolute top-0 left-0 w-full h-full pointer-events-none hidden md:block z-0"
                                viewBox={`0 0 1000 ${height}`}
                                preserveAspectRatio="none"
                            >
                                {(() => {
                                    const pathD = data.reduce((acc, _, index) => {
                                        if (index >= data.length - 1) return acc;
                                        if (index === 0)
                                            return "M 290 150 C 500 150, 550 270, 710 270"; // 1 -> 2
                                        if (index === 1)
                                            return acc + " C 850 270, 500 350, 290 450"; // 2 -> 3
                                        if (index === 2)
                                            return acc + " C 290 600, 550 720, 750 720"; // 3 -> 4
                                        if (index === 3)
                                            return acc + " C 950 720, 500 800, 290 850"; // 4 -> 5
                                        return acc;
                                    }, "");
                                    return (
                                        <m.path
                                            d={pathD}
                                            stroke="currentColor"
                                            className="text-neutral-300"
                                            strokeWidth="2"
                                            strokeDasharray="8 6"
                                            fill="none"
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                            initial={{ strokeDashoffset: 0 }}
                                            animate={{
                                                strokeDashoffset: -140, // Multiple of 14 (8+6) for seamless loop
                                            }}
                                            transition={{
                                                duration: 3,
                                                repeat: Infinity,
                                                ease: "linear",
                                            }}
                                        />
                                    );
                                })()}
                            </svg>
                        )}

                        {data.map((step, index) => {
                            const position = positions[index % positions.length] ?? { className: "", rotate: "" };

                            return (
                                <Card
                                    key={step.title}
                                    number={`0${index + 1}`}
                                    title={step.title}
                                    description={step.description}
                                    colorTheme={step.colorTheme || "blue"}
                                    colors={step.colors}
                                    rotate={position?.rotate}
                                    className={position?.className}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </LazyMotion>
    );
}