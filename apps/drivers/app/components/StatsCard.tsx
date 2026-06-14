"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { useGetDriverStats } from "@repo/api";
import { formatCurrency } from "~/lib/utils";

export default function StatsCard() {
  const { data: stats, isLoading } = useGetDriverStats();

  const statsData = [
    {
      name: "Total Earnings",
      value: isLoading
        ? "..."
        : formatCurrency(stats?.totalEarnings || 0),
    },
    {
      name: "Pending Payments",
      value: isLoading ? "..." : formatCurrency(stats?.pendingPayments || 0),
    },
     {
      name: "In Review",
      value: isLoading ? "..." : formatCurrency(stats?.inReviewPayments || 0),
    },
    {
      name: "Passengers",
      value: isLoading ? "..." : String(stats?.totalPassengers || 0),
    },
  ];

  return (
    <div className="flex items-center justify-center py-10">
      <div className="grid grid-cols-1 gap-px rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-4 w-full">
        {statsData.map((stat, index) => (
          <Card
            key={stat.name}
            className={cn(
              "rounded-none border-0 shadow-none py-0",
              index === 0 && "rounded-l-xl",
              index === statsData.length - 1 && "rounded-r-xl",
            )}
          >
            <CardContent className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 sm:p-6 bg-white">
              <div className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </div>
              <div className="tabular-nums w-full flex-none text-3xl font-medium tracking-tight text-foreground">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
