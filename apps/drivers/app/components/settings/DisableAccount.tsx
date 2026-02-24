"use client";

import { Button } from "@repo/ui/components/button";

export default function DisableAccount() {
    return (
        <div className="mt-10 pt-6 border-t border-red-100">
            <div className="mb-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold mb-1 text-red-600">Disable Account</h2>
                <p className="text-sm text-muted-foreground">
                    Disabling your account will remove your profile from the platform. You will lose access to all your data and will not be able to receive new trip requests.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-sm font-medium">Disable my driver account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This action is irreversible. Please be certain before proceeding.</p>
                </div>
                <Button variant="destructive" type="button">
                    Disable Account
                </Button>
            </div>
        </div>
    );
}
