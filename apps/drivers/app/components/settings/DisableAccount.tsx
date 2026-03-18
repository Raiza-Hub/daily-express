"use client";

import { Button } from "@repo/ui/components/button";

export default function DisableAccount() {
    return (
        <div className="mt-10 pt-6 border-t border-red-100">
            <div className="mb-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold mb-1 text-red-600">Disable Account</h2>
                <p className="text-sm text-muted-foreground">
                    You can temporarily disable your driver account at any time.
                    While disabled, your profile will be hidden and you won’t receive trip requests.
                    You can restore your account whenever you're ready.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-sm font-medium">Disable my driver account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Your data will be preserved and your account can be reactivated anytime.
                    </p>
                </div>
                <Button variant="destructive" type="button" className="cursor-pointer">
                    Disable Account
                </Button>
            </div>
        </div>
    );
}
