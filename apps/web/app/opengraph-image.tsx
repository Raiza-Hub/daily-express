import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

const brandLogoUrl = new URL("../public/brand-logo.png", import.meta.url);
const emailBrandBackground = "#0f172a";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const brandLogoData = await readFile(brandLogoUrl, "base64");
  const brandLogoSrc = `data:image/png;base64,${brandLogoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: emailBrandBackground,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <img
          src={brandLogoSrc}
          alt="Daily Express"
          width={430}
          height={154}
          style={{
            display: "flex",
            height: "154px",
            objectFit: "contain",
            width: "430px",
          }}
        />
      </div>
    ),
    size,
  );
}
