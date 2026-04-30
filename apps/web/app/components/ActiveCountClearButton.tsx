
const ActiveCountClearButton = ({
  activeCount,
  onClear,
}: {
  activeCount: number;
  onClear: () => void;
}) => {
  if (activeCount === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClear}
      className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
    >
      Clear all filters ({activeCount})
    </button>
  );
}

export default ActiveCountClearButton;