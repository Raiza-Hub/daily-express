"use client";

import { useGetAllDriverRoutes } from "@repo/api";
import DriverRouteDetailsCard from "./DriverRouteDetailsCard";
import DriverRoutesEmptyState from "./DriverRoutesEmptyState";
import DriverRoutesErrorState from "./DriverRoutesErrorState";
import DriverRoutesLoadingState from "./DriverRoutesLoadingState";
import { sortDriverRoutes } from "./driverRoutesShared";

export default function DriverRoutesPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useGetAllDriverRoutes();

  const routes = sortDriverRoutes(data ?? []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            My Routes
          </h1>
          <p className="text-sm text-muted-foreground">
            View every route you&apos;ve created and keep track of their status.
          </p>
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Refreshing routes...</p>
          ) : null}
        </div>
      </div>

      {isLoading ? <DriverRoutesLoadingState /> : null}

      {isError ? (
        <DriverRoutesErrorState
          message={
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while fetching routes."
          }
          onRetry={() => refetch()}
        />
      ) : null}

      {!isLoading && !isError && routes.length === 0 ? <DriverRoutesEmptyState /> : null}

      {!isLoading && !isError && routes.length > 0 ? (
        <div className="grid gap-4">
          {routes.map((route) => (
            <DriverRouteDetailsCard
              key={route.id}
              route={route}
              onRouteChanged={() => {
                void refetch();
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
