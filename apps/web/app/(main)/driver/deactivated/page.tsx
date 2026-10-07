import Image from "next/image";
import { Mail } from "lucide-react";
import { redirect } from "next/navigation";
import { getDriverProfileState } from "~/lib/driver-session";

export default async function DriverDeactivatedPage() {
    if ((await getDriverProfileState()) === "active") {
        redirect("/driver/calendar");
    }

    return (
        <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
            <Image
                src="/not-found-duck3.jpg"
                alt=""
                width={480}
                height={404}
                className="h-auto w-80 sm:w-96"
            />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Your driver account is deactivated
            </h2>
            <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
                You won&apos;t receive new ride requests until your driver profile is
                reactivated. Your profile and trip history are kept safe, so contact
                support and we&apos;ll get you back on the road.
            </p>
            <a
                href="mailto:help@beckon.taxi?subject=Driver%20account%20reactivation"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <Mail aria-hidden="true" className="h-4 w-4" />
                Email support
            </a>
        </div>
    );
}
