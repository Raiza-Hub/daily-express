"use client";

import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { NIGERIAN_STATES } from "~/lib/driverData";
import { formatPhoneDisplay, PHONE_PLACEHOLDER } from "~/lib/phone";
import type { DriverSignupData, DriverStepErrors } from "~/lib/driverSignup";

interface AddressInfoStepProps {
    data: DriverSignupData;
    errors: DriverStepErrors;
    onChange: (patch: Partial<DriverSignupData>) => void;
}

const AddressInfoStep = ({ data, errors, onChange }: AddressInfoStepProps) => {
    const selectedStateCities =
        NIGERIAN_STATES.find((state) => state.name === data.state)?.cities ?? [];

    return (
        <div className="flex flex-col gap-6">
            {/* State */}
            <Field label="State" htmlFor="state" error={errors.state}>
                <Select
                    id="state"
                    value={data.state}
                    invalid={Boolean(errors.state)}
                    onChange={(value) => {
                        onChange({ state: value, city: "" });
                    }}
                    placeholder="Select state"
                    items={[
                        { value: "", label: "Select state", disabled: true },
                        ...NIGERIAN_STATES.map((state) => ({
                            value: state.name,
                            label: state.name,
                        })),
                    ]}
                />
            </Field>

            {/* City */}
            <Field label="City" htmlFor="city" error={errors.city}>
                <Select
                    id="city"
                    value={data.city}
                    invalid={Boolean(errors.city)}
                    disabled={!data.state}
                    onChange={(value) => {
                        onChange({ city: value });
                    }}
                    placeholder={
                        data.state ? "Select city" : "Select a state first"
                    }
                    items={[
                        {
                            value: "",
                            label: data.state ? "Select city" : "Select a state first",
                            disabled: true,
                        },
                        ...selectedStateCities.map((city) => ({
                            value: city,
                            label: city,
                        })),
                    ]}
                />
            </Field>

            {/* Home address */}
            <Field label="Home address" htmlFor="address" error={errors.address}>
                <Input
                    id="address"
                    value={data.address}
                    onChange={(event) => onChange({ address: event.target.value })}
                    invalid={Boolean(errors.address)}
                    autoComplete="street-address"
                    placeholder="Street, area, landmark"
                />
            </Field>

            {/* Phone number */}
            <Field
                label="Phone number"
                htmlFor="phoneNumber"
                error={errors.phoneNumber}
            >
                <Input
                    id="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    value={data.phoneNumber}
                    onChange={(event) => onChange({ phoneNumber: formatPhoneDisplay(event.target.value) })}
                    invalid={Boolean(errors.phoneNumber)}
                    autoComplete="tel"
                    placeholder={PHONE_PLACEHOLDER}
                />
            </Field>
        </div>
    );
};

export { AddressInfoStep };