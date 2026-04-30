import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1d4ed8 45%, #38bdf8 100%)",
          color: "#f8fafc",
          padding: "56px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            borderRadius: "32px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(15, 23, 42, 0.28)",
            padding: "48px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#bfdbfe",
              }}
            >
              Daily Express
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: "780px",
                fontSize: 76,
                lineHeight: 1.05,
                fontWeight: 800,
              }}
            >
              Find and book your next trip in minutes
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: "760px",
                fontSize: 30,
                lineHeight: 1.35,
                color: "#dbeafe",
              }}
            >
              Search routes, compare fares, and reserve seats across trusted
              Daily Express trips.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "14px",
                fontSize: 26,
                color: "#e0f2fe",
              }}
            >
              <span>Search</span>
              <span>Compare</span>
              <span>Book</span>
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.14)",
                padding: "14px 22px",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              dailyexpress.app
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
