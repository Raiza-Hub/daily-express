"use client";

import { PencilLine, Trash2 } from "lucide-react";
import type { TripPassenger } from "./passenger-drawer";

interface PassengerListItemProps {
  passenger: TripPassenger;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function maskPart(part: string) {
  if (part.length <= 1) return part;
  if (part.length === 2) return `${part[0]}*`;
  return `${part[0]}${"*".repeat(part.length - 2)}${part[part.length - 1]}`;
}

function maskEmailAddress(email: string) {
  const [local = "", ...domainParts] = email.split("@");
  if (!local) return email;
  const [username = "", ...tldParts] = (domainParts.join("@") || "").split(".");
  if (!username) return email;
  const tld = tldParts.length > 0 ? `.${tldParts.join(".")}` : "";
  return `${maskPart(local)}@${maskPart(username)}${tld}`;
}

function PassengerListItem({
  passenger,
  onEdit,
  onRemove,
}: PassengerListItemProps) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">
          {passenger.fullName}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {maskEmailAddress(passenger.email)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {passenger.carriesLuggage && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
            Luggage
          </span>
        )}
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit ${passenger.fullName}`}
            onClick={() => onEdit(passenger.id)}
            className="cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <PencilLine className="h-4 w-4" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${passenger.fullName}`}
            onClick={() => onRemove(passenger.id)}
            className="cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

export { PassengerListItem };