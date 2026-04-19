import logger from '../utils/logger.js'

function errorHandler(err, req, res, next) {
  // log error
  logger.error("Request Error", err, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
  });

  const pgErrorCodes = {
    23505: { status: 409, message: "Duplicate entry" },
    "42P01": { status: 500, message: "Database table does not exist" },
    23503: { status: 400, message: "Foreign key constraint violation" },
    23502: { status: 400, message: "Required missing fields" },
    "22P02": { status: 400, message: "Invalid input syntax" },
  };
  // Handle psql errors
  if (err.code && pgErrorCodes[err.code]) {
    const { status, message } = pgErrorCodes[err.code];
    return res.status(status).json({
      success: false,
      message,
      detail: process.env.NODE_ENV === "development" ? err.detail : undefined,
    });
  }
  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors,
    });
  }
  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }
  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.id,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export default errorHandler;
