import { ReactNode } from "react";
import SearchBar from "./SearchBar";

type TripStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  initialOrigin?: string | null;
  initialDate?: string | null;
  disabled?: boolean;
};

const TripState = ({
  icon,
  title,
  description,
  initialOrigin,
  initialDate,
  disabled,
}: TripStateProps) => {
  return (
    <div className="flex flex-col gap-6">
      <SearchBar
        key={`${initialOrigin}-${initialDate}`}
        initialOrigin={initialOrigin}
        initialDate={initialDate}
        disabled={disabled}
      />

      <div className="flex-1 w-full">
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <div>{icon}</div>
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-center text-neutral-400">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default TripState;