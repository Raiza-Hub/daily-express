import { Input } from "@repo/ui/components/input";

const SearchLocationField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition">
      <label htmlFor={id} className="text-xs text-neutral-400">
        {label}
      </label>

      <Input
        id={id}
        value={value}
        placeholder="City or university"
        autoComplete="off"
        className="border-0 p-0 h-auto text-sm font-medium bg-transparent shadow-none focus-visible:ring-0 rounded-none"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default SearchLocationField;
