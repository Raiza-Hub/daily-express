"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

export default function DriverRoutesEmptyState() {
  return (
    <Card className="border-dashed border-slate-300 shadow-none">
      <CardHeader className="gap-2">
        <CardTitle>No routes yet</CardTitle>
        <CardDescription>
          Create your first route to start publishing trip options for passengers.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
