"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";

export default function PaymentCancelledPage() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("reference");

    return (
        <div className="min-h-screen bg-neutral-50 px-4 py-16">
            <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Payment cancelled</p>
                    <h1 className="text-3xl font-semibold text-neutral-950">Your booking payment was not completed</h1>
                    <p className="text-sm text-neutral-600">
                        You can return to the trip list and try again when you are ready.
                    </p>
                </div>

                {reference ? (
                    <p className="text-sm text-neutral-500">
                        Reference: <span className="font-medium text-neutral-800">{reference}</span>
                    </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link href="/">Choose another trip</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/trip-status">Trip status</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
