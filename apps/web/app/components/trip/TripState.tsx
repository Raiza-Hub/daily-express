import { ReactNode } from "react";
import TripFilter from "./TripFilter";

type TripStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

const TripState = ({ icon, title, description }: TripStateProps) => {
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <TripFilter onApplyFilters={() => {}} />

      <div className="flex-1 w-full">
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <div>{icon}</div>
          <p className="text-neutral-500">{title}</p>
          <p className="text-sm text-center text-neutral-400">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default TripState;
