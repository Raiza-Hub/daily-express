import { CheckCircleIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import type { ReactNode } from "react";

export interface DriverInfoProps {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    country: string;
    state: string;
    profilePictureUrl: string;
    vehicleMake: string;
    vehicleModel: string;
    vehiclePlateNumber: string;
    vehicleColor: string;
}

export const DriverInfo = ({
    firstName,
    lastName,
    phoneNumber,
    country,
    state,
    profilePictureUrl,
    vehicleMake,
    vehicleModel,
    vehiclePlateNumber,
    vehicleColor,
}: DriverInfoProps) => {
    const fullName = `${firstName} ${lastName}`;
    const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

    return (
        <div className="rounded-2xl bg-white overflow-hidden">
            {/* Profile header */}
            <div className="flex flex-col items-center gap-3 px-6 py-8 border-b border-gray-100">
                <Avatar className="h-24 w-24 ring-4 ring-white shadow-sm">
                    <AvatarImage className="object-cover" src={profilePictureUrl || ""} alt={fullName} />
                    <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <p className="text-lg font-bold text-gray-900">{fullName}</p>
            </div>


            {/* Driver details */}
            <div>
                <div className="px-5 py-3 bg-gray-50 border-y border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Driver Details</p>
                </div>
                <Row
                    label="Full Name"
                    value={fullName}
                />
                {/* use a library if you want to support other countries phone number format */}
                <Row
                    label="Phone Number"
                    value={formatPhoneNumber(phoneNumber)}
                />
                <Row
                    label="State"

                    value={state}
                />
                <Row
                    label="Country"
                    value={country}
                />
                <Row
                    label="Account Verification"
                    value={<VerificationBadge />}
                    last
                />
            </div>

            {/* Vehicle details */}
            <div>
                <div className="px-5 py-3 bg-gray-50 border-y border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Vehicle Details</p>
                </div>
                <Row
                    label="Make & Model"
                    value={`${vehicleMake} ${vehicleModel}`}
                />
                <Row
                    label="Color"
                    value={vehicleColor}
                />
                <Row
                    label="Plate Number"
                    value={vehiclePlateNumber}
                    last
                />
            </div>
        </div>
    );
};

const Row = ({
    label,
    value,
    icon,
    last,
}: {
    label: string;
    value: ReactNode;
    icon?: ReactNode;
    last?: boolean;
}) => (
    <div
        className={`flex items-center justify-between px-5 py-3.5 ${last ? "" : "border-b border-dashed border-gray-200"
            }`}
    >
        <span className="flex items-center gap-1.5 text-sm text-neutral-500">
            {icon}
            {label}
        </span>
        <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
);

const VerificationBadge = () => (
    <div className="inline-flex items-center rounded-full border border-gray-200 px-1 py-1">
        <div className="flex items-center gap-1.5 px-2.5">
            <CheckCircleIcon weight="fill" className="size-4 text-emerald-600" />
            <span className="text-sm font-medium text-gray-900">ID Verified</span>
        </div>
    </div>
);

const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("234") && digits.length === 13) {
        return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
    }

    return phone;
};