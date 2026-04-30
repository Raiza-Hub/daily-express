"use client";

import { useForm } from "react-hook-form";
import { TRoute } from "@repo/types/index";
import { Button } from "@repo/ui/components/button";
import {
  RouteInformationSection,
  RoutePricingSection,
  RouteScheduleSection,
} from "./RouteFormSections";
import type { RouteFormUi } from "./useRouteFormUi";

export interface CreateRouteFormProps {
  control: ReturnType<typeof useForm<TRoute>>["control"];
  handleSubmit: ReturnType<typeof useForm<TRoute>>["handleSubmit"];
  isSubmitting: boolean;
  onSubmit: (data: TRoute) => void;
  onCancel: () => void;
  ui: RouteFormUi;
  FooterWrapper: React.FC<{ children: React.ReactNode }>;
}

export function CreateRouteForm({
  control,
  handleSubmit,
  isSubmitting,
  onSubmit,
  onCancel,
  ui,
  FooterWrapper,
}: CreateRouteFormProps) {
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-8 py-6 px-4 sm:px-1 overflow-y-auto"
    >
      <RouteInformationSection control={control} ui={ui} />
      <RoutePricingSection control={control} ui={ui} />
      <RouteScheduleSection control={control} />

      <FooterWrapper>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button type="submit" variant="submit" disabled={isSubmitting}>
          Create Route
        </Button>
      </FooterWrapper>
    </form>
  );
}
