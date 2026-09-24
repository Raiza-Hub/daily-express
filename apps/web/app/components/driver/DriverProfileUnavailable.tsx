"use client";

import Link from "next/link";
import { getApiErrorMessage, isApiError } from "@repo/api";
import { Button } from "~/components/ui/button";

const DriverProfileUnavailable = ({ error }: { error: unknown }) => {
    const isNotFound = isApiError(error) && error.code === "DRIVER_NOT_FOUND";

    return (
        <div className="w-full min-w-0 max-w-3xl">
            {isNotFound ? (
                <div className="flex flex-col items-start gap-4">
                    <p className="text-sm text-foreground">
                        You don't have a driver profile yet.
                    </p>
                    <Link href="/driver/signup">
                        <Button pill className="font-semibold text-sm">
                            Create driver profile
                        </Button>
                    </Link>
                </div>
            ) : (
                <p className="text-sm text-destructive">
                    {getApiErrorMessage(error, "Something went wrong. Please try again.")}
                </p>
            )}
        </div>
    );
};

export { DriverProfileUnavailable };