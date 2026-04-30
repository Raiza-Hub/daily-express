"use client";

import {
  CheckCircleIcon,
  SpinnerIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@repo/ui/components/badge";
import { useDriverPayoutHistory } from "@repo/api";
import { formatCurrency } from "~/lib/utils";


const PayoutTable = () => {
  const {
    data: payouts = [],
    isLoading,
    isError,
    error
  } = useDriverPayoutHistory({
    limit: 20,
  });

  console.log(error);
  

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <SpinnerIcon className="mr-2 animate-spin" />
        Loading payouts...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Unable to load payouts right now.
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-4 pr-4 font-semibold text-gray-500 text-sm">
                  Date
                </th>
                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">
                  Reference
                </th>
                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">
                  Payout Amount
                </th>
                <th className="py-4 px-4 font-semibold text-gray-500 text-sm">
                  Settled Amount
                </th>
                <th className="py-4 pl-4 font-semibold text-gray-500 text-sm text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td
                    className="py-10 text-sm text-muted-foreground"
                    colSpan={5}
                  >
                    No payouts yet.
                  </td>
                </tr>
              )}
              {payouts.map((payout) => {
                const settledAmount = payout.koraFeeAmount
                  ? payout.amountMinor - payout.koraFeeAmount
                  : payout.amountMinor;

                const getStatusDisplay = () => {
                  if (payout.status === "success") {
                    return {
                      icon: (
                        <CheckCircleIcon
                          weight="fill"
                          className="fill-green-500 dark:fill-green-400"
                        />
                      ),
                      label: "Success",
                    };
                  }
                  if (payout.status === "failed") {
                    return {
                      icon: <SpinnerIcon className="animate-spin" />,
                      label: payout.nextRetryAt ? "Retry scheduled" : "Failed",
                    };
                  }
                  if (payout.status === "processing") {
                    return {
                      icon: <SpinnerIcon className="animate-spin" />,
                      label: "Processing",
                    };
                  }
                  if (payout.status === "permanent_failed") {
                    return {
                      icon: (
                        <XCircleIcon
                          weight="fill"
                          className="fill-red-500 dark:fill-red-400"
                        />
                      ),
                      label: "Needs review",
                    };
                  }
                  return {
                    icon: <SpinnerIcon />,
                    label: "Pending",
                  };
                };

                const statusDisplay = getStatusDisplay();

                return (
                  <tr
                    key={payout.id}
                    className="group border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                  >
                    <td className="py-6 pr-4 text-gray-600 font-normal text-sm">
                      {new Date(payout.createdAt).toDateString()}
                    </td>
                    <td className="py-6 px-4 text-gray-600 font-normal text-sm">
                      {payout.reference}
                    </td>
                    <td className="py-6 px-4 text-gray-600 font-normal text-sm">
                      {formatCurrency(payout.amountMinor, payout.currency)}
                    </td>
                    <td className="py-6 px-4 text-gray-600 font-bold text-sm">
                      {payout.status === "success"
                        ? formatCurrency(settledAmount, payout.currency)
                        : "-"}
                    </td>
                    <td className="py-6 pl-4 text-right">
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground px-1.5"
                      >
                        {statusDisplay.icon}
                        {statusDisplay.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayoutTable;
