"use client"

import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema, TSignUpSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import ChangePasswordDialog from "./ChangePasswordDialog";
import DeleteAccount from "./DeleteAccount";
import { z } from "zod";
import dayjs from "dayjs";

const ProfileSchema = SignUpSchema.omit({ password: true });
type TProfileSchema = z.infer<typeof ProfileSchema>;


const Profile = () => {
    const [open, setOpen] = useState(false)
    const [date, setDate] = useState<Date | undefined>(undefined)

    const {
        handleSubmit,
        control,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<TProfileSchema>({
        resolver: zodResolver(ProfileSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            dateOfBirth: new Date(),
        },
    });

    const onSubmit = (data: TProfileSchema) => {
        console.log("Account form submitted:", data);
    };

    return (
        <div className="space-y-20">
            <div>
                <div className="mb-6 py-4 border-b border-gray-100">
                    <h1 className="text-xl font-semibold mb-1">Profile</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage settings for your Daily Express profile.
                    </p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldGroup className="space-y-6">

                        {/* Full Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                            <FieldLabel htmlFor="firstName" className="pt-2.5">
                                Full Name
                            </FieldLabel>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Controller
                                    name="firstName"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <Input
                                                id="firstName"
                                                {...field}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="First name on ID"
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="lastName"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <Input
                                                id="lastName"
                                                {...field}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Last name on ID"
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                            <FieldLabel htmlFor="email" className="pt-2.5">
                                Email
                            </FieldLabel>

                            <Controller
                                name="email"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <Input
                                            {...field}
                                            id="email"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Email"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </div>

                        {/* Date of Birth */}
                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                            <FieldLabel htmlFor="dateOfBirth" className="pt-2.5">
                                Date of birth
                            </FieldLabel>

                            <Controller
                                name="dateOfBirth"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <Input
                                            {...field}
                                            id="dateOfBirth"
                                            type="date"
                                            aria-invalid={fieldState.invalid}
                                            value={field.value ? dayjs(field.value).format("YYYY-MM-DD") : ""}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value
                                                        ? dayjs(e.target.value, "YYYY-MM-DD").toDate()
                                                        : undefined
                                                )
                                            }
                                            className="bg-transparent [&::-webkit-calendar-picker-indicator]:hidden"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </div>

                    </FieldGroup>

                    <div className="mt-8 flex justify-end">
                        <Button variant="secondary" type="submit" className="cursor-pointer" disabled={isSubmitting}>
                            {isSubmitting ? "Saving…" : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>

            <div>
                <div className="mb-6 py-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold mb-1">Authentication</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage your password and authentication settings.
                    </p>
                </div>

                <div className="grid grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                    <FieldLabel className="pt-2.5">
                        Password
                    </FieldLabel>
                    <ChangePasswordDialog />
                </div>
            </div>

            <DeleteAccount />
        </div>
    )
}
export default Profile