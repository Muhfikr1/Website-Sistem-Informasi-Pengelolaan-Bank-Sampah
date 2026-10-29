import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level: logLevel,
  redact: {
    paths: [
      "password",
      "password_hash",
      "token",
      "cookie",
      "VAPID_PRIVATE_KEY",
      "*.password",
      "*.password_hash",
      "*.token",
      "*.cookie",
      "*.VAPID_PRIVATE_KEY",
      "headers.cookie",
      "headers.authorization",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

