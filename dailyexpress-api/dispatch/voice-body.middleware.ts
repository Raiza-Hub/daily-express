import type { RequestHandler } from "express";

function parseMultipartFields(
  raw: string,
  boundary: string,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of raw.split(`--${boundary}`)) {
    const separator = part.indexOf("\r\n\r\n");
    if (separator === -1) continue;
    const name = /name="([^"]+)"/.exec(part.slice(0, separator))?.[1];
    if (!name) continue;
    let value = part.slice(separator + 4);
    if (value.endsWith("\r\n")) value = value.slice(0, -2);
    fields[name] = value;
  }
  return fields;
}

export const parseVoiceBody: RequestHandler = (req, _res, next) => {
  if (req.body !== undefined) {
    next();
    return;
  }

  const contentType = String(req.headers["content-type"] ?? "");
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];

  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    raw += chunk;
  });
  req.on("end", () => {
    if (contentType.includes("multipart/form-data")) {
      req.body = boundary ? parseMultipartFields(raw, boundary) : {};
    } else {
      req.body = Object.fromEntries(new URLSearchParams(raw));
    }
    next();
  });
  req.on("error", next);
};
