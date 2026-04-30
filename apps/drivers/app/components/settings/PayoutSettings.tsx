"use client";

import { useDriverPayoutBalance, useGetDriver } from "@repo/api";
import Image from "next/image";
import BankList from "../../../bank-names.json";
import VerificationBadge from "../VerificationBadge";
import ChangeBankDetailsDialog from "./ChangeBankDetailsDialog";
import { Bank } from "~/lib/type";
import { formatCurrency } from "~/lib/utils";
import Loader from "../Loader";

const PayoutSettings = () => {
  const { data: driver, isLoading } = useGetDriver();
  const { data: payoutBalance, isError: isPayoutBalanceError } =
    useDriverPayoutBalance();

  const matchedBank = (BankList as Bank[]).find(
    (bank) =>
      bank.code === driver?.bankCode ||
      bank.name.toLowerCase() === driver?.bankName?.toLowerCase(),
  );
  const bankSlug = matchedBank?.slug || "";
  const hasBankDetails = Boolean(driver?.bankName && driver?.bankCode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader text="Loading payout details..." />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 border-b border-gray-100 py-4">
        <h1 className="mb-1 text-xl font-semibold">Bank Details</h1>
        <p className="text-sm text-muted-foreground">
          Manage your payout account. Payouts are processed automatically
          shortly after trip completion.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex items-center justify-between md:contents">
          <div className="flex items-center justify-center relative w-10 h-10">
            {bankSlug ? (
              <Image
                src={`/logos/${bankSlug}.png`}
                alt={driver?.bankName || "Bank"}
                fill
                sizes="40px"
                unoptimized
                className="rounded-sm object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-sm bg-muted" />
            )}
          </div>

          <div className="md:order-3">
            <VerificationBadge
              hasBankDetails={hasBankDetails}
              status={driver?.bankVerificationStatus}
            />
          </div>
        </div>

        <div className="mt-2 md:order-2 md:mt-0">
          <p className="font-semibold tracking-wide">
            {driver?.accountName || "No account set"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {driver?.accountNumber ? `${driver.accountNumber} · ` : ""}
            {driver?.bankName || "No bank set"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Available payout:{" "}
            {isPayoutBalanceError
              ? "Unavailable right now"
              : formatCurrency(
                  payoutBalance?.availableAmountMinor || 0,
                  driver?.currency,
                )}
          </p>
          {driver?.bankVerificationStatus === "pending" && (
            <p className="mt-2 text-sm text-amber-700">
              We are verifying this account with Kora. Payouts will start after
              the status turns active.
            </p>
          )}
          {driver?.bankVerificationStatus === "failed" && (
            <p className="mt-2 text-sm text-red-600">
              {driver.bankVerificationFailureReason ||
                "Bank verification failed. Update the details and try again."}
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end md:order-4 md:mt-0">
          <ChangeBankDetailsDialog />
        </div>
      </div>
    </div>
  );
};

export default PayoutSettings;
