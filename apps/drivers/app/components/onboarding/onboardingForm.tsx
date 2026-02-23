"use client"

import {
    Stepper,
    StepperDescription,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from "@repo/ui/components/stepper"
import { onboardingSchema, TonboardingSchema } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { Button } from "@repo/ui/components/button";
import { CircleNotchIcon } from "@phosphor-icons/react";
import PersonalInfoForm from "./PersonalInfo";
import AddressInfoForm from "./AddressInfo";
import PaymentInfo from "./PaymentInfo";
import Link from "next/link";
import { Icons } from "../Icons";

const STEPS = [
    { id: 1, title: "Personal Information", description: "Enter your details as they appear on your government ID.", Component: PersonalInfoForm, fields: ["file", "firstName", "lastName", "email"] },
    { id: 2, title: "Location & Contact Details", description: "Provide your current residential and contact details.", Component: AddressInfoForm, fields: ["city", "state", "country", "address", "phoneNumber"] },
    { id: 3, title: "Payment Information", description: "Your earnings will be paid into this account.", Component: PaymentInfo, fields: ["bankName", "accountNumber", "accountName"] }
]

const OnboardingForm = () => {
    const router = useRouter();
    const isPending = false
    const [currentStep, setCurrentStep] = useState<number>(1)

    const methods = useForm<TonboardingSchema>({
        resolver: zodResolver(onboardingSchema),
        mode: "onChange",
        defaultValues: {
            firstName: "",
            lastName: "",
            file: undefined,
            email: "",
            country: "",
            address: "",
            city: "",
            state: "",
            phoneNumber: "",
            bankName: "",
            accountNumber: "",
            accountName: "",
        },
    });

    const { handleSubmit, trigger } = methods
    const currentStepData = STEPS[currentStep - 1]
    const CurrentStepComponent = currentStepData?.Component || (() => null)

    const onSubmit = (data: TonboardingSchema) => {
        console.log(data)
    }

    const onNext = async () => {
        const currentData = STEPS[currentStep - 1]
        if (!currentData) return

        const stepFields = currentData.fields as (keyof TonboardingSchema)[]
        const isStepValid = await trigger(stepFields)

        if (!isStepValid) {
            console.log(methods.formState.errors);
            return
        }

        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1)
        } else {
            await handleSubmit(onSubmit)()
        }
    }


    return (
        <div className="max-w-4xl mx-auto space-y-8 text-center">
            {/* <div className='ml-4 flex justify-center items-center lg:ml-0'>
                <Link href='/'>
                    <Icons.logo className='h-10 w-10' />
                </Link>
            </div> */}

            <Stepper
                value={currentStep}
                onValueChange={async (next) => {
                    if (next === currentStep) return
                    
                    // Allow backward navigation without validation
                    if (next < currentStep) {
                        setCurrentStep(next)
                        return
                    }

                    const currentData = STEPS[currentStep - 1]
                    if (!currentData) return

                    const ok = await methods.trigger(
                        currentData.fields as (keyof TonboardingSchema)[]
                    )
                    if (ok) setCurrentStep(next)
                }}
            >
                {STEPS.map(({ id, title, description }) => (
                    <StepperItem
                        key={id}
                        step={id}
                        className="relative flex-1 flex-col!"
                    >
                        <StepperTrigger className="flex-col gap-3 rounded">
                            <StepperIndicator />
                            <div className="space-y-0.5 px-2">
                                <StepperTitle>{title}</StepperTitle>
                                <StepperDescription className="max-sm:hidden">
                                    {description}
                                </StepperDescription>
                            </div>
                        </StepperTrigger>
                        {id < STEPS.length && (
                            <StepperSeparator className="absolute inset-x-0 top-3 left-[calc(50%+0.75rem+0.125rem)] -order-1 m-0 -translate-y-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none" />
                        )}
                    </StepperItem>
                ))}
            </Stepper>

            <FormProvider  {...methods}>
                <form
                    className="space-y-8"
                    onSubmit={async (e) => {
                        e.preventDefault()
                        await onNext()
                    }}
                >
                    <div className="max-w-lg mx-auto mt-10 text-start">
                        <CurrentStepComponent />
                    </div>

                    {/* Display Error message  */}

                    {/* {error && (
                        <p className="px-1 inline-flex justify-center text-sm text-red-500">
                            {error.message}
                        </p>
                    )} */}

                    <div className="flex justify-center space-x-4 mb-8">
                        <Button
                            variant="outline"
                            className="w-32 bg-transparent cursor-pointer"
                            type="button"
                            onClick={() => {
                                if (currentStep > 1) {
                                    setCurrentStep((prev) => prev - 1)
                                    console.log("Moved back to step:", currentStep - 1)
                                }
                            }}
                            disabled={currentStep === 1}
                        >
                            Prev step
                        </Button>

                        <Button className="w-32 cursor-pointer" type="submit" disabled={isPending}>
                            {isPending ? (
                                <CircleNotchIcon className="size-4 animate-spin" />
                            ) : (
                                currentStep === STEPS.length ? "Finish" : "Next step"
                            )}
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </div>
    );
};

export default OnboardingForm