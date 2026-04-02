"use client";

import { Badge } from "@repo/ui/components/badge";
import Image from "next/image";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { useGetDriver } from "@repo/api";
import ChangeBankDetailsDialog from "./ChangeBankDetailsDialog";

const bankSlugMap: Record<string, string> = {
  OPay: "paycom",
};

export default function PayoutSettings() {
  const { data: driver, isLoading } = useGetDriver();

  const bankSlug =
    bankSlugMap[driver?.bankName || ""] ||
    driver?.bankName?.toLowerCase().replace(/\s+/g, "-") ||
    "";
  const isActive = driver?.isActive ?? null;

  if (isLoading) {
    return (
      <div>
        <div className="mb-6 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold mb-1">Bank Details</h1>
          <p className="text-sm text-muted-foreground">
            Manage your payout accounts and banking details. Payouts are
            processed every 2 hours during active trips, subject to bank
            processing times.
          </p>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CircleNotchIcon className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-semibold mb-1">Bank Details</h1>
        <p className="text-sm text-muted-foreground">
          Manage your payout accounts and banking details. Payouts are processed
          every 2 hours during active trips, subject to bank processing times.
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
                src={`/logos/${bankSlug}.png`}
                alt={driver?.bankName || "Bank"}
                width={40}
                height={40}
                className="rounded-sm object-contain"
              />
            </div>

            {/* Status Badge */}
            <div className="md:order-3">
              {isActive === true && (
                <Badge className="gap-1.5" variant="secondary">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-emerald-500"
                  />
                  Active
                </Badge>
              )}
              {isActive === false && (
                <Badge className="gap-1.5" variant="destructive">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-red-500"
                  />
                  Failed
                </Badge>
              )}
              {isActive === null && (
                <Badge className="gap-1.5" variant="outline">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-gray-400"
                  />
                  No bank set
                </Badge>
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className="mt-2 md:mt-0 md:order-2">
            <p className="font-semibold tracking-wide">
              {driver?.accountName || "No account set"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {driver?.accountNumber ? `${driver.accountNumber} · ` : ""}
              {driver?.bankName || "No bank set"}
            </p>
          </div>

          {/* Action Dialog */}
          <div className="mt-2 md:mt-0 md:order-4 flex justify-end">
            <ChangeBankDetailsDialog />
          </div>
        </div>
      </div>
    </div>
  );
}
