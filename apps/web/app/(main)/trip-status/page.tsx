import TripStatusCard from "~/components/trip/TripStatusCard";
import TripStatusFilter from "~/components/trip/TripStatusFilter";


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