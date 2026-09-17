"use client";

import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { NIGERIAN_STATES } from "~/lib/driverData";
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
                    onChange={(event) => {
                        onChange({ state: event.target.value, city: "" });
                    }}
                >
                    <option value="" disabled>
                        Select state
                    </option>
                    {NIGERIAN_STATES.map((state) => (
                        <option key={state.name} value={state.name}>
                            {state.name}
                        </option>
                    ))}
                </Select>
            </Field>

            {/* City */}
            <Field label="City" htmlFor="city" error={errors.city}>
                <Select
                    id="city"
                    value={data.city}
                    invalid={Boolean(errors.city)}
                    disabled={!data.state}
                    onChange={(event) => {
                        onChange({ city: event.target.value });
                    }}
                >
                    <option value="" disabled>
                        {data.state ? "Select city" : "Select a state first"}
                    </option>
                    {selectedStateCities.map((city) => (
                        <option key={city} value={city}>
                            {city}
                        </option>
                    ))}
                </Select>
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
                    onChange={(event) => onChange({ phoneNumber: event.target.value })}
                    invalid={Boolean(errors.phoneNumber)}
                    autoComplete="tel"
                    placeholder="+234 801 234 5678"
                />
            </Field>
        </div>
    );
};

export { AddressInfoStep };