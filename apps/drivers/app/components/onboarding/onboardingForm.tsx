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
import { onboardingCreateSchema, TonboardingCreateSchema } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@repo/ui/components/sonner";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useCreateDriver,
  useQueryClient,
  presignProfileUploadFn,
  uploadToR2Fn,
  confirmProfileUploadFn,
} from "@repo/api";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@repo/ui/components/button";
import { usePostHog } from "posthog-js/react";
import { posthogEvents } from "~/lib/posthog-events";
import PersonalInfoForm from "./PersonalInfo";
import AddressInfoForm from "./AddressInfo";

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
];

const OnboardingForm = () => {
  const router = useRouter();
  const posthog = usePostHog();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const methods = useForm<TonboardingCreateSchema>({
    resolver: zodResolver(onboardingCreateSchema),
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
    },
  });

  const { handleSubmit, trigger } = methods;
  const pendingFileRef = useRef<File | null>(null);


  const { mutate: createDriver, isPending } = useCreateDriver({
    onSuccess: async (data) => {
      posthog.capture(posthogEvents.driver_onboarding_completed);
      queryClient.setQueryData(["driver"], data);

      router.push("/");

      const file = pendingFileRef.current;
      if (file) {
        pendingFileRef.current = null;
        try {
          const presign = await presignProfileUploadFn(file.type, file.size);
          await uploadToR2Fn(presign.uploadUrl, file);
          await confirmProfileUploadFn(presign.key);
        } catch {
          toast.error("Profile picture upload failed. You can update it later in settings.");
        }
      }
    },
    onError: (error: Error) => {
      applyApiFieldErrors<keyof TonboardingCreateSchema>(error, methods.setError, {
        phone: "phoneNumber",
        profile_pic: "file",
      });
      posthog.captureException(error, {
        action: "driver_onboarding_submission_failed",
      });
      setOnboardError(getApiErrorMessage(error, "Driver onboarding failed"));
    },
  });
  const currentStepData = STEPS[currentStep - 1];
  const CurrentStepComponent = currentStepData?.Component || (() => null);

  const onSubmit = (data: TonboardingCreateSchema) => {
    setOnboardError(null);

    pendingFileRef.current = data.file instanceof File ? data.file : null;

    createDriver({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phoneNumber,
      address: data.address,
      country: data.country,
      currency: data.currency,
      state: data.state,
      city: data.city,
    });
  };

  const onNext = async () => {
    const currentData = STEPS[currentStep - 1];
    if (!currentData) return;

    const stepFields = currentData.fields as (keyof TonboardingCreateSchema)[];
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
            currentData.fields as (keyof TonboardingCreateSchema)[],
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

          {onboardError && (
            <p className="mb-4 text-center text-sm text-red-500">
              {onboardError}
            </p>
          )}
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
                  const lastStepFields = STEPS[STEPS.length - 1]
                    ?.fields as (keyof TonboardingCreateSchema)[];
                  const isValid = await trigger(lastStepFields);
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
