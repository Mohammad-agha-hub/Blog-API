import winston from "winston";
import "winston-daily-rotate-file";

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    // App logs —  14 days, max 20MB per file
    new winston.transports.DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
    }),
    // Error logs —  30 days
    new winston.transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "30d",
      maxSize: "20m",
    }),
    // Security logs —  90 days (legal/audit reasons)
    new winston.transports.DailyRotateFile({
      filename: "logs/security-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "90d",
    }),
  ],
});

//  console in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({ format: winston.format.simple() }),
  );
}

export default logger;
