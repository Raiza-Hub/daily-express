import { MapPinAreaIcon, PhoneCallIcon } from "@phosphor-icons/react";
import { Avatar, AvatarImage } from "@repo/ui/components/avatar";

export interface DriverInfoProps {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    country: string;
    state: string;
    profilePictureUrl: string;
}

export const DriverInfo = ({ firstName, lastName, phoneNumber, country, state, profilePictureUrl }: DriverInfoProps) => {
    const fullName = `${firstName} ${lastName}`;

    return (
        <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
            <p className="text-base font-semibold mb-4">Driver Details</p>
            <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                    <Avatar className="h-16 w-16">
                        <AvatarImage
                            className="object-cover"
                            src={profilePictureUrl || ""}
                            alt={fullName}
                        />
                    </Avatar>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                    <p className="text-base font-medium leading-none">{fullName}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <PhoneCallIcon />
                            <span className="text-sm text-neutral-600">{phoneNumber}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MapPinAreaIcon />
                            <span className="text-sm text-neutral-600">
                                {state}, {country}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
