const isProd = process.env.NODE_ENV === "production";

export const logger = {
  info: (msg: unknown, ...args: unknown[]) => {
    if (!isProd) console.log(msg, ...args);
  },
  warn: (msg: unknown, ...args: unknown[]) => {
    console.warn(msg, ...args);
  },
  error: (msg: unknown, ...args: unknown[]) => {
    console.error(msg, ...args);
  },
};
