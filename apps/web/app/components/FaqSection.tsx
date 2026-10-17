"use client";

import { Accordion } from "@base-ui/react/accordion";
import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { cn } from "@repo/ui/lib/utils";

const ROW_GRID =
    "grid grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] gap-x-3 md:grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] md:gap-x-6";

interface FaqItem {
    question: string;
    answer: string;
}

interface FaqGroup {
    title: string;
    items: FaqItem[];
}

const FAQ_GROUPS: FaqGroup[] = [
    {
        title: "Before you book",
        items: [
            {
                question: "Do I have to fill all four seats?",
                answer:
                    "No. A booking is the whole vehicle, so the fare covers all four seats whether your group fills them or travels with fewer — you add at least one passenger and up to four. The trip runs as soon as a driver accepts it; it does not wait to fill up.",
            },
            {
                question: "How much will it cost?",
                answer:
                    "Fares are fixed per departure point and shown before you book. A booking is the whole vehicle, so you pay the fare and service fee for all four seats, plus a luggage charge only for passengers travelling with luggage. All amounts are in naira, and nothing is added after you confirm.",
            },
            {
                question: "How do I pay?",
                answer:
                    "By bank transfer through Kora, our payment provider, on Kora's own checkout page. We never see or store your payment details. Your booking is confirmed when Kora confirms the payment, so wait for the confirmation email before you travel.",
            },
        ],
    },
    {
        title: "If something goes wrong",
        items: [
            {
                question: "What happens if the trip doesn't run?",
                answer:
                    "We cancel it and refund every passenger who paid, automatically, to the account the payment came from — you never have to ask. Refunds cover the fare; service fees are not refunded, because they are not passed on to the driver.",
            },
            {
                question: "What if I need to cancel, or my plans change?",
                answer:
                    "Tell us before the departure time and we will look at what we can do, including moving you to the next available departure. You cannot cancel in the app yourself yet, and the later you tell us, the fewer options we have.",
            },
            {
                question: "How do I reach support?",
                answer:
                    "Email support@dailyexpress.app or call +234 9063611541. If you have paid and nothing has arrived by the departure time, contact us straight away and we will trace it.",
            },
        ],
    },
    {
        title: "Driving with us",
        items: [
            {
                question: "Is there a fee to join, and what do I keep?",
                answer:
                    "There is no fee to join. You are paid the fare for the trips you complete, minus nothing on our side, and we transfer it to your verified bank account once the trip is complete. If a transfer fails we email you, and you can retry it from your calendar.",
            },
            {
                question: "Can I turn down a trip without hurting my chances of more?",
                answer:
                    "Declining costs you nothing and does not remove you from the platform. Offers are ranked on how long you have been waiting and how many offers you have already answered, so drivers who accept everything are not automatically first in line.",
            },
        ],
    },
];

export interface FaqSectionProps {
    faqs?: FaqItem[];
    className?: string;
}

export default function FaqSection({ faqs, className }: FaqSectionProps) {
    const groups: FaqGroup[] =
        faqs && faqs.length > 0 ? [{ title: "", items: faqs }] : FAQ_GROUPS;
    let questionNumber = 0;

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
                    {groups.map((group, groupIndex) => (
                        <div
                            key={group.title || `faq-group-${groupIndex}`}
                            className={groupIndex === 0 ? undefined : "mt-12 md:mt-16"}
                        >
                            {group.title ? (
                                <div className="flex items-center gap-4 pb-4 md:gap-6">
                                    <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                        {group.title}
                                    </h3>
                                    <span
                                        aria-hidden="true"
                                        className="h-px flex-1 bg-neutral-200"
                                    />
                                </div>
                            ) : null}
                            <Accordion.Root
                                defaultValue={
                                    groupIndex === 0 && group.items[0]
                                        ? [group.items[0].question]
                                        : []
                                }
                            >
                                {group.items.map((item, itemIndex) => {
                                    questionNumber += 1;
                                    const number = String(
                                        questionNumber,
                                    ).padStart(2, "0");

                                    return (
                                        <Accordion.Item
                                            key={item.question}
                                            value={item.question}
                                            className={cn(
                                                "group border-t border-neutral-200 last:border-b",
                                                group.title && itemIndex === 0
                                                    ? "border-t-0"
                                                    : undefined,
                                            )}
                                        >
                                            <Accordion.Header
                                                render={<h4 className="m-0" />}
                                            >
                                                <Accordion.Trigger
                                                    className={cn(
                                                        ROW_GRID,
                                                        "w-full items-start py-5 text-left transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-neutral-900 md:py-6",
                                                    )}
                                                >
                                                    <span className="pt-1 text-xs font-medium tabular-nums tracking-[0.14em] text-neutral-500 transition-colors duration-300 group-data-open:text-[#c2007f]">
                                                        {number}
                                                    </span>
                                                    <span className="bg-[image:linear-gradient(#f108ac,#f108ac)] bg-[length:0px_2px] bg-left-bottom bg-no-repeat pb-1 text-lg font-medium leading-snug tracking-[-0.01em] text-neutral-900 text-pretty transition-[background-size] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-open:bg-[length:28px_2px] md:text-xl">
                                                        {item.question}
                                                    </span>
                                                    <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-neutral-300 text-neutral-500 transition-colors duration-300 hover:border-neutral-400 hover:text-neutral-700 group-data-open:border-[#f108ac] group-data-open:text-[#c2007f] md:size-7">
                                                        <Plus
                                                            aria-hidden="true"
                                                            className="absolute size-3.5 rotate-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-open:rotate-90 group-data-open:opacity-0"
                                                            strokeWidth={2}
                                                        />
                                                        <Minus
                                                            aria-hidden="true"
                                                            className="absolute size-3.5 -rotate-90 opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-open:rotate-0 group-data-open:opacity-100"
                                                            strokeWidth={2}
                                                        />
                                                    </span>
                                                </Accordion.Trigger>
                                            </Accordion.Header>
                                            <Accordion.Panel className="group/panel h-(--accordion-panel-height) overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-[starting-style]:h-0 data-[ending-style]:h-0">
                                                <div
                                                    className={cn(
                                                        ROW_GRID,
                                                        "pb-6 pt-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[starting-style]/panel:translate-y-1 group-data-[starting-style]/panel:opacity-0 group-data-[ending-style]/panel:translate-y-1 group-data-[ending-style]/panel:opacity-0 md:pb-8 md:pt-2",
                                                    )}
                                                >
                                                    <p className="col-span-3 col-start-1 max-w-[64ch] text-[15px] leading-relaxed text-neutral-600 text-pretty md:col-span-1 md:col-start-2 md:text-base">
                                                        {item.answer}
                                                    </p>
                                                </div>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    );
                                })}
                            </Accordion.Root>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}