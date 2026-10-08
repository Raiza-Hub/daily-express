import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Beckōn — Get there comfortably, book your trip in seconds.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoSrc = `data:image/png;base64,${await readFile(
    join(process.cwd(), "assets", "og-logo.png"),
    "base64",
)}`;

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 32,
                    background: "#ffffff",
                    color: "#0a0a0a",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        padding: 48,
                        borderRadius: 48,
                        background: "#f4f4f5",
                    }}
                >
                    <img src={logoSrc} width={320} height={240} alt="Beckōn" />
                </div>
                <div style={{ fontSize: 88, fontWeight: 700 }}>Beckōn</div>
                <div style={{ fontSize: 36, color: "#52525b" }}>
                    Get there comfortably, book your trip in seconds.
                </div>
            </div>
        ),
        size,
    );
}