function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold text-neutral-900">
      {children}
    </p>
  );
}

export default SectionLabel;