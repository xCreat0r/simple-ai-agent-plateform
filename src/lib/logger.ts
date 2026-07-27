import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: isProd ? "info" : "debug",
  transport: isProd
    ? undefined
    : {
        target: "pino/file",
        options: { destination: 1 },
      },
  redact: isProd
    ? ["headers.authorization", "headers.cookie", "req.headers.authorization", "req.headers.cookie"]
    : [],
});
