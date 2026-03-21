"use client"

import { CircleNotchIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";


const ResendButton = () => {
    const isResending = false

    return (
        <Button
            variant="link"
            size="sm"
            type="button"
            // onClick={() => resend()}
            // disabled={isPending || isResending}
            className="text-zinc-900 underline hover:text-zinc-700 transition-colors -ml-2 cursor-pointer"
        >
            {isResending ? (
                <div className="inline-flex items-center gap-2">
                    <CircleNotchIcon className="size-4 animate-spin" />
                    Resending
                </div>
            ) : (
                "Resend email"
            )}
        </Button>
    )
}

export default ResendButton;