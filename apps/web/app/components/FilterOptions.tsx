import { CheckboxItem } from "./CheckboxItem";
import { FilterSection } from "./FilterSection";

interface FilterOptionsProps {
  currentVehicleTypes: string[];
  onToggle: (value: string) => void;
  vehicleTypeData: { label: string; value: string; count?: number }[];
}

const FilterOptions = ({
  currentVehicleTypes,
  onToggle,
  vehicleTypeData,
}: FilterOptionsProps) => {
  return (
    <div className="divide-y divide-slate-100">
      <FilterSection title="Vehicle Type">
        {vehicleTypeData.map((item) => (
          <CheckboxItem
            key={item.value}
            label={item.label}
            count={item.count}
            checked={currentVehicleTypes.includes(item.value)}
            onChange={() => onToggle(item.value)}
          />
        ))}
      </FilterSection>
    </div>
  );
};

export default FilterOptions;
