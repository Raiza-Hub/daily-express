"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

interface DriverRoutesErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function DriverRoutesErrorState({
  message,
  onRetry,
}: DriverRoutesErrorStateProps) {
  return (
    <Card className="border-red-200 shadow-none">
      <CardHeader className="gap-2">
        <CardTitle className="text-red-700">Unable to load your routes</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry} className="cursor-pointer">
          <ArrowClockwiseIcon size={16} />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
