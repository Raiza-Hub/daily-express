"use client"

import { Switch } from "@repo/ui/components/switch"
import { useState } from "react"

export default function DeactivateRoutesSettings() {
    const [isDeactivated, setIsDeactivated] = useState(false)

    return (
        <div>
            <div className="mb-6 py-4 border-b border-gray-100">
                <h1 className="text-xl font-semibold mb-1">Route Status</h1>
                <p className="text-sm text-muted-foreground">
                    Manage the availability of all your assigned routes.
                </p>
            </div>

            <div className="flex items-start gap-4">
                <Switch
                    className="mt-1"
                    checked={isDeactivated}
                    onCheckedChange={setIsDeactivated}
                    aria-label="Deactivate all routes"
                />
                <div className="space-y-1">
                    <p className="font-medium tracking-wide border-gray-100">
                        Temporarily disable all routes
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Turn this on to temporarily hide and disable all your routes. You won't receive any new bookings or requests while this is active. You can re-enable them at any time.
                    </p>
                </div>
            </div>
        </div>
    )
}
