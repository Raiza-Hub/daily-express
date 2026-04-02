"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRefreshPaymentStatus } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { SpinnerIcon, CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";

export default function PaymentReturnPage() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("reference") || "";
    const [hasTriggered, setHasTriggered] = useState(false);
    const { mutateAsync, data, error, isPending } = useRefreshPaymentStatus();

    useEffect(() => {
        if (!reference || hasTriggered) {
            return;
        }

        setHasTriggered(true);
        void mutateAsync(reference);
    }, [reference, hasTriggered, mutateAsync]);

    const status = data?.status || "pending";
    const isSuccess = status === "successful";
    const isFailed = status === "failed" || status === "cancelled" || status === "expired";

    return (
        <div className="min-h-screen bg-neutral-50 px-4 py-16">
            <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Payment return</p>
                    <h1 className="text-3xl font-semibold text-neutral-950">Booking payment status</h1>
                    <p className="text-sm text-neutral-600">
                        We verify your payment before confirming the booking.
                    </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                    {!reference ? (
                        <div className="flex items-center gap-3 text-neutral-700">
                            <XCircleIcon size={20} className="text-red-500" />
                            <p>Missing payment reference in the return URL.</p>
                        </div>
                    ) : isPending ? (
                        <div className="flex items-center gap-3 text-neutral-700">
                            <SpinnerIcon size={20} className="animate-spin" />
                            <p>Verifying payment and confirming your booking.</p>
                        </div>
                    ) : isSuccess ? (
                        <div className="flex items-center gap-3 text-neutral-700">
                            <CheckCircleIcon size={20} className="text-emerald-500" weight="fill" />
                            <div>
                                <p className="font-medium">Payment successful</p>
                                <p className="text-sm text-neutral-600">Your booking has been confirmed.</p>
                            </div>
                        </div>
                    ) : isFailed ? (
                        <div className="flex items-center gap-3 text-neutral-700">
                            <XCircleIcon size={20} className="text-red-500" weight="fill" />
                            <div>
                                <p className="font-medium">Payment not completed</p>
                                <p className="text-sm text-neutral-600">{data?.failureReason || "The booking was not confirmed."}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-neutral-700">
                            <SpinnerIcon size={20} className="animate-spin" />
                            <p>Payment is still pending. Refresh this page shortly.</p>
                        </div>
                    )}
                </div>

                {error ? (
                    <p className="text-sm text-red-600">{error.message}</p>
                ) : null}

                {reference ? (
                    <div className="text-sm text-neutral-500">
                        Reference: <span className="font-medium text-neutral-800">{reference}</span>
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link href="/trip-status">View trip status</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">Back to trips</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
