import TripStatusFilter from "~/components/TripStatusFilter";
import TripStatusCard from "~/components/TripStatusCard";

const Page = () => {
    return (
        <div className="w-full max-w-4xl mx-auto">
            <div>
                <TripStatusFilter />
            </div>
            <TripStatusCard />
        </div>
    );
};

export default Page;