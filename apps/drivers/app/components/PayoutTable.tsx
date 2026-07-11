"use client";

import { useRef, useEffect } from "react";
import {
  CheckCircleIcon,
  SpinnerIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@repo/ui/components/badge";
import { useDriverPayoutHistory } from "@repo/api";
import { formatCurrency } from "~/lib/utils";


const PayoutTable = () => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriverPayoutHistory({
    limit: 20,
  });

  const payouts = data?.pages.flatMap((page) => page.payouts) ?? [];

  const sentinelRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


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
                <th className="py-4 pl-4 font-semibold text-gray-500 text-sm text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td
                    className="py-12 text-sm text-muted-foreground"
                    colSpan={4}
                  >
                    No payouts yet.
                  </td>
                </tr>
              )}
              {payouts.map((payout) => {
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
                    if (payout.nextRetryAt) {
                      return {
                        icon: <SpinnerIcon className="animate-spin" />,
                        label: "Retry scheduled",
                      };
                    }
                    return {
                      icon: (
                        <XCircleIcon
                          weight="fill"
                          className="fill-red-500 dark:fill-red-400"
                        />
                      ),
                      label: "Failed",
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
                        <WarningCircleIcon
                          weight="fill"
                          className="fill-amber-500 dark:fill-amber-400"
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
              {isFetchingNextPage && (
                <tr>
                  <td colSpan={4} className="py-4 text-center">
                    <SpinnerIcon className="animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {hasNextPage && !isFetchingNextPage && (
                <tr ref={sentinelRef}>
                  <td colSpan={4} className="h-px" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayoutTable;
