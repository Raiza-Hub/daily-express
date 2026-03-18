"use client";

import { Button } from "@repo/ui/components/button";
import { CheckCircleIcon, FunnelIcon, SpinnerIcon, XCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@repo/ui/components/badge";

const PayoutTable = () => {
    const payouts = [
        {
            id: 1,
            date: "Sat Jan 31, 2026",
            recipient: "Wisdom Private",
            amount: "NGN 36,610.20",
            settled: "NGN 36,610.20",
            status: "Done",
        },
        {
            id: 2,
            date: "Sat Jan 31, 2026",
            recipient: "Wisdom Private",
            amount: "NGN 36,610.20",
            settled: "NGN 36,610.20",
            status: "Pending",
        },
        {
            id: 3,
            date: "Sat Jan 31, 2026",
            recipient: "Wisdom Private",
            amount: "NGN 36,610.20",
            settled: "NGN 36,610.20",
            status: "Failed",
        },
    ];

    return (
        <div className="w-full bg-white">
            {/* Header */}
            {/* <div className="flex items-center justify-between px-8 py-4 border-b border-neutral-200 sticky top-16 z-50 bg-white">
                <div className="flex items-center gap-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700">
                    <FunnelIcon size={18} weight="fill" className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-400">Filters</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1 rounded-md h-9 text-sm cursor-pointer">
                        Export CSV
                    </Button>
                </div>
            </div> */}

            {/* Table */}
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="py-4 pr-4 font-semibold text-gray-500 text-sm">Payout For</th>
                                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">Recipient</th>
                                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">Payout Amount</th>
                                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">Settled Amount</th>
                                <th className="py-4 pl-4 font-semibold text-gray-500 text-sm text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.map((payout) => (
                                <tr key={payout.id} className="group border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                    <td className="py-6 pr-4 text-gray-600 font-normal text-sm">{payout.date}</td>
                                    <td className="py-6 px-4 text-gray-600 font-normal text-sm">{payout.recipient}</td>
                                    <td className="py-6 px-4 text-gray-600 font-normal text-sm">{payout.amount}</td>
                                    <td className="py-6 px-4 text-gray-600 font-bold text-sm">{payout.settled}</td>
                                    <td className="py-6 pl-4 text-right">
                                        <Badge variant="secondary" className="text-muted-foreground px-1.5">
                                            {payout.status === "Done" ? (
                                                <CheckCircleIcon weight="fill" className="fill-green-500 dark:fill-green-400" />
                                            ) : payout.status === "Pending" ? (
                                                <SpinnerIcon />
                                            ) : (
                                                <XCircleIcon weight="fill" className="fill-red-500 dark:fill-red-400" />
                                            )}
                                            {payout.status}
                                        </Badge>

                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PayoutTable;