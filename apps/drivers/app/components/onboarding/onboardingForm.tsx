"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@repo/ui/components/stepper";
import { onboardingSchema, TonboardingSchema } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateDriver, useGetDriver } from "@repo/api";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { usePostHog } from "posthog-js/react";
import { posthogEvents } from "~/lib/posthog-events";
import PersonalInfoForm from "./PersonalInfo";
import AddressInfoForm from "./AddressInfo";
import PaymentInfo from "./PaymentInfo";
import BankList from "../../../bank-names.json";
import { Bank } from "~/lib/type";

const STEPS = [
  {
    id: 1,
    title: "Personal Information",
    description: "Enter your details as they appear on your government ID.",
    Component: PersonalInfoForm,
    fields: ["file", "firstName", "lastName", "email"],
  },
  {
    id: 2,
    title: "Location & Contact Details",
    description: "Provide your current residential and contact details.",
    Component: AddressInfoForm,
    fields: ["city", "state", "country", "currency", "address", "phoneNumber"],
  },
  {
    id: 3,
    title: "Payment Information",
    description: "Your earnings will be paid into this account.",
    Component: PaymentInfo,
    fields: ["bankName", "accountNumber", "bankCode", "accountName"],
  },
];

const OnboardingForm = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const [currentStep, setCurrentStep] = useState<number>(1);

  const { data: driver, isLoading } = useGetDriver({ enabled: true });

  useEffect(() => {
    if (!isLoading && driver) {
      router.replace("/");
    }
  }, [driver, isLoading, router]);

  const { mutate: createDriver, isPending } = useCreateDriver({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_onboarding_completed);
      router.push("/");
    },
    onError: (error: Error) => {
      posthog.captureException(error, {
        action: "driver_onboarding_submission_failed",
      });
      toast.error("Something went wrong.", { description: error.message });
    },
  });

  const methods = useForm<TonboardingSchema>({
    resolver: zodResolver(onboardingSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      file: undefined as unknown as File,
      email: "",
      country: "",
      currency: "",
      address: "",
      city: "",
      state: "",
      phoneNumber: "",
      bankName: "",
      bankCode: "",
      accountNumber: "",
      accountName: "",
    },
  });

  const { handleSubmit, trigger } = methods;
  const currentStepData = STEPS[currentStep - 1];
  const CurrentStepComponent = currentStepData?.Component || (() => null);

  const onSubmit = (data: TonboardingSchema) => {
    const formData = new FormData();
    const selectedBank = (BankList as Bank[]).find(
      (bank) => bank.name === data.bankName,
    );
    const bankCode = selectedBank?.code || "";

    if (data.file instanceof File) {
      formData.append("file", data.file);
    }
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    formData.append("email", data.email);
    formData.append("phone", data.phoneNumber);
    formData.append("address", data.address);
    formData.append("country", data.country);
    formData.append("currency", data.currency);
    formData.append("state", data.state);
    formData.append("city", data.city);
    formData.append("bankName", data.bankName);
    formData.append("bankCode", bankCode);
    formData.append("accountNumber", data.accountNumber);
    formData.append("accountName", data.accountName);

    createDriver(formData);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CircleNotchIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onNext = async () => {
    const currentData = STEPS[currentStep - 1];
    if (!currentData) return;

    const stepFields = currentData.fields as (keyof TonboardingSchema)[];
    const isStepValid = await trigger(stepFields);

    if (!isStepValid) {
      posthog.captureException(
        new Error(`Validation failed at step ${currentStep}`),
        {
          action: "driver_onboarding_validation_failed",
          step: currentStep,
        },
      );
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    } else {
      await handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-center">
      <Stepper
        value={currentStep}
        onValueChange={async (next) => {
          if (next === currentStep) return;

          if (next < currentStep) {
            setCurrentStep(next);
            return;
          }

          const currentData = STEPS[currentStep - 1];
          if (!currentData) return;

          const ok = await methods.trigger(
            currentData.fields as (keyof TonboardingSchema)[],
          );
          if (ok) setCurrentStep(next);
        }}
      >
        {STEPS.map(({ id, title, description }) => (
          <StepperItem key={id} step={id} className="relative flex-1 flex-col!">
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

      <FormProvider {...methods}>
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(onSubmit)(e);
          }}
        >
          <div className="max-w-lg mx-auto mt-10 text-start">
            <CurrentStepComponent />
          </div>

          <div className="flex justify-center space-x-4 mb-8">
            <Button
              variant="outline"
              className="w-32 bg-transparent cursor-pointer"
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep((prev) => prev - 1);
                }
              }}
              disabled={currentStep === 1}
            >
              Prev step
            </Button>

            <Button
              className="w-32 cursor-pointer"
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={async () => {
                if (currentStep === STEPS.length) {
                  const step3Fields = STEPS[2]
                    ?.fields as (keyof TonboardingSchema)[];
                  const isValid = await trigger(step3Fields);
                  if (isValid) {
                    handleSubmit(onSubmit)();
                  }
                } else {
                  onNext();
                }
              }}
            >
              {isPending && (
                <CircleNotchIcon className="h-4 w-4 animate-spin" />
              )}
              {currentStep === STEPS.length ? "Finish" : "Next step"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export default OnboardingForm;
