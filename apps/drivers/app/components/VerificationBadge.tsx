import { Badge } from "@repo/ui/components/badge";


const VerificationBadge = (props: {
  hasBankDetails: boolean;
  status?: "pending" | "active" | "failed";
}) => {
  if (!props.hasBankDetails) {
    return (
      <Badge className="gap-1.5" variant="outline">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-gray-400"
        />
        No bank set
      </Badge>
    );
  }

  if (props.status === "pending") {
    return (
      <Badge className="gap-1.5" variant="secondary">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-amber-500"
        />
        Pending
      </Badge>
    );
  }

  if (props.status === "failed") {
    return (
      <Badge className="gap-1.5" variant="destructive">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-white/90"
        />
        Failed
      </Badge>
    );
  }

  return (
    <Badge className="gap-1.5" variant="outline">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-emerald-500"
      />
      Active
    </Badge>
  );
}

export default VerificationBadge;