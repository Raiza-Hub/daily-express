import Image from "next/image";

function TripNotFound({
  title = "No trips available",
  subtext = "We couldn't find this origin. Please book from an available origin.",
}: {
  title?: string;
  subtext?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 py-12 text-center">
      <Image
        src="/not-found.webp"
        alt="Not found"
        width={320}
        height={240}
        className="h-auto w-64"
      />
      <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      <p className="max-w-sm text-sm text-neutral-500">{subtext}</p>
    </div>
  );
}

export default TripNotFound;