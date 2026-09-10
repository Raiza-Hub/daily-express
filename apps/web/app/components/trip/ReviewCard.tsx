"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { formatPrice } from "@repo/ui/lib/utils";

const ReviewCard = ({
  total,
  luggageFee,
  onBook,
  isBooking,
  disabled,
}: {
  total: number;
  luggageFee: number;
  onBook: () => void;
  isBooking: boolean;
  disabled: boolean;
}) => {
  return (
    <div className="bg-white rounded-2xl p-6">
      <h2 className="text-xl font-bold text-gray-900">Pricing</h2>

      <div className="flex items-center justify-between mt-4">
        <span className="text-base font-bold text-gray-900">Total:</span>
        <span className="text-2xl font-bold text-gray-900">
          {formatPrice(total)}
        </span>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">incl. luggage fee</span>
        <span className="text-xs text-gray-400">{formatPrice(luggageFee)}</span>
      </div>

      <Button
        size="lg"
        className="w-full mt-4 gap-2 font-medium bg-blue-600 hover:bg-blue-700 text-white"
        onClick={onBook}
        disabled={disabled}
      >
        {isBooking ? (
          <CircleNotchIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          "Book"
        )}
      </Button>
    </div>
  );
};

export default ReviewCard;