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
            "linear-gradient(135deg, #052e16 0%, #0f766e 42%, #164e63 100%)",
          color: "#ecfeff",
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
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(8, 47, 73, 0.28)",
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
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#99f6e4",
              }}
            >
              Daily Express Driver
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: "820px",
                fontSize: 74,
                lineHeight: 1.05,
                fontWeight: 800,
              }}
            >
              Manage routes, trips, and payouts from one dashboard
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: "760px",
                fontSize: 30,
                lineHeight: 1.35,
                color: "#ccfbf1",
              }}
            >
              Keep route cards updated, monitor activity, and stay ready for
              the next booking cycle.
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
                color: "#cffafe",
              }}
            >
              <span>Routes</span>
              <span>Trips</span>
              <span>Payouts</span>
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
              driver.dailyexpress.app
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
