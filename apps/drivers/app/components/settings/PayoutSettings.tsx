import { Badge } from "@repo/ui/components/badge"
import Image from "next/image"
import ChangeBankDetailsDialog from "./ChangeBankDetailsDialog"

export default function PayoutSettings() {
    return (
        <div>
            <div className="mb-6 py-4 border-b border-gray-100">
                <h1 className="text-xl font-semibold mb-1">Bank Details</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your payout accounts and banking details. Payouts are processed every 2 hours during active trips, subject to bank processing times.
                </p>
            </div>

            <div className="">

                {/* Bank Row */}
                <div className="flex flex-col gap-3 md:flex-row md:gap-0 md:justify-between md:items-center">

                    {/* Logo + Badge row on small screens */}
                    <div className="flex items-center justify-between md:contents">
                        {/* Bank Logo */}
                        <div className="flex items-center justify-center">
                            <Image
                                src="/logos/guaranty-trust-bank.png"
                                alt="Guaranty Trust Bank"
                                width={40}
                                height={40}
                                className="rounded-sm object-contain"
                            />
                        </div>

                        {/* Status Badge */}
                        <div className="md:order-3">
                            <Badge className="gap-1.5" variant="secondary">
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-emerald-500"
                                />
                                Active
                            </Badge>
                        </div>
                    </div>

                    {/* Account Details */}
                    <div className="mt-2 md:mt-0 md:order-2">
                        <p className="font-semibold tracking-wide">
                            ADEBOLA OLUWASEMILORE WISDOM
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            0524404864 · Guaranty Trust Bank
                        </p>
                    </div>

                    {/* Action Dialog */}
                    <div className="mt-2 md:mt-0 md:order-4 flex justify-end">
                        <ChangeBankDetailsDialog />
                    </div>

                </div>
            </div>
        </div>
    )
}
