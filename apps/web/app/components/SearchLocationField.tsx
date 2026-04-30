import { Input } from "@repo/ui/components/input";
import { LocationDropdown } from "@repo/ui/components/location-dropdown";
import { LocationFieldState } from "@repo/ui/hooks/use-location-field";


const SearchLocationField = ({
  id,
  label,
  value,
  fieldState,
  otherField,
}: {
  id: string;
  label: string;
  value: string;
  fieldState: LocationFieldState;
  otherField?: LocationFieldState;
}) => {
  return (
    <div
      ref={fieldState.ref}
      className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition"
    >
      <label htmlFor={id} className="text-xs text-neutral-400">
        {label}
      </label>

      <Input
        id={id}
        value={value}
        placeholder="City or university"
        autoComplete="off"
        className="border-0 p-0 h-auto text-sm font-medium bg-transparent shadow-none focus-visible:ring-0 rounded-none"
        onFocus={() => fieldState.focus(otherField)}
        onChange={(event) =>
          fieldState.handleInputChange(event.target.value, otherField)
        }
      />

      <LocationDropdown
        visible={fieldState.isOpen}
        suggestions={fieldState.suggestions}
        isLoading={fieldState.isLoading}
        message={fieldState.message}
        query={value}
        onSelect={(location) => fieldState.select(location)}
      />
    </div>
  );
}

export default SearchLocationField;