"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { cn } from "@repo/ui/lib/utils";

interface FaqItem {
    question: string;
    answer: string;
}

const DEFAULT_FAQS: FaqItem[] = [
    {
        question: "How do I book a ride?",
        answer:
            "Select your pickup location and destination, pick a date, and confirm. Your driver will be matched and details shared instantly.",
    },
    {
        question: "How is pricing calculated?",
        answer:
            "Fares are based on the route you pick and are shown upfront before you confirm your booking — no surprises.",
    },
    {
        question: "Are drivers verified?",
        answer:
            "Yes. Every driver undergoes identity and bank verification before they can accept rides on Beckōn.",
    },
    {
        question: "Can I cancel or change my ride?",
        answer:
            "You can cancel or withdraw from your trip before your driver departs, and refunds are handled straight back to your account.",
    },
    {
        question: "What if my train is delayed?",
        answer:
            "No problem. Let us know as early as you can and we'll help you move to the next available slot.",
    },
    {
        question: "How do I get help or support?",
        answer:
            "Reach out to us and our support team usually responds within a few hours.",
    },
];

export interface FaqSectionProps {
    faqs?: FaqItem[];
    className?: string;
}

export default function FaqSection({ faqs, className }: FaqSectionProps) {
    const items = faqs && faqs.length > 0 ? faqs : DEFAULT_FAQS;

    return (
        <section className={cn("px-6", className)}>
            <div className="max-w-6xl mx-auto grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
                <div className="mx-auto w-full max-w-3xl text-center lg:mx-0 lg:max-w-none lg:text-left">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Have questions? Relax, we have the answers.
                    </h2>
                    <p className="text-neutral-500 text-lg">
                        If you can&rsquo;t find an answer that you&rsquo;re
                        looking for, feel free to drop us a line.
                    </p>
                    <Image
                        src="/faq-2.jpg"
                        alt=""
                        width={1125}
                        height={1125}
                        className="mx-auto mt-8 hidden w-64 lg:mx-0 lg:block lg:w-80 xl:w-96"
                    />
                </div>

                <div className="mx-auto w-full max-w-3xl lg:mx-0 lg:max-w-none">
                    <Accordion.Root
                        defaultValue={[String(items[0]?.question ?? "")]}
                        className="space-y-4"
                    >
                        {items.map((item) => (
                            <Accordion.Item
                                key={item.question}
                                value={item.question}
                                className="group border border-neutral-200 rounded-2xl bg-white data-open:bg-neutral-50 overflow-hidden"
                            >
                                <Accordion.Header>
                                    <Accordion.Trigger className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:bg-neutral-50">
                                        <span className="text-lg md:text-xl font-semibold leading-[1.3] text-neutral-800">
                                            {item.question}
                                        </span>
                                        <ChevronDown className="shrink-0 size-5 text-neutral-400 transition-transform duration-200 group-data-open:rotate-180" />
                                    </Accordion.Trigger>
                                </Accordion.Header>
                                <Accordion.Panel className="px-6">
                                    <p className="pb-6 text-neutral-600 text-base leading-relaxed">
                                        {item.answer}
                                    </p>
                                </Accordion.Panel>
                            </Accordion.Item>
                        ))}
                    </Accordion.Root>
                </div>
            </div>
        </section>
    );
}