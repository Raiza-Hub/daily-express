export interface AWSPlaceDetails {
    PlaceId: string;
    PlaceType: string;
    Title: string;
    PricingBucket: string;
    Address: {
        Label: string;
        Locality: string;
        City: string;
        Street: string;
        PostalCode: string;
        Country: {
            Code2: string;
            Code3: string;
            Name: string;
        };
        Region: {
            Name: string;
        };
        SubRegion: {
            Name: string;
        };
        [key: string]: any;
    };
    Position: number[];
    Categories: Array<{
        Id: string;
        Name: string;
        LocalizedName: string;
        Primary: boolean;
        [key: string]: any;
    }>;
    $metadata: {
        httpStatusCode: number;
        requestId: string;
        attempts: number;
        totalRetryDelay: number;
        [key: string]: any;
    };
    [key: string]: any;
}
