import { CheckboxItem } from "./CheckboxItem";
import { FilterSection } from "./FilterSection";

interface FilterOptionsProps {
  currentDepartureTime: string | null;
  onToggle: (value: string) => void;
  departureTimeData: { label: string; value: string; count?: number }[];
}

const FilterOptions = ({
  currentDepartureTime,
  onToggle,
  departureTimeData,
}: FilterOptionsProps) => {
  return (
    <div className="divide-y divide-slate-100">
      <FilterSection title="Departure Time">
        {departureTimeData.map((item) => (
          <CheckboxItem
            key={item.value}
            label={item.label}
            count={item.count}
            checked={item.value === currentDepartureTime}
            onChange={() => onToggle(item.value)}
          />
        ))}
      </FilterSection>
    </div>
  );
};

export default FilterOptions;
