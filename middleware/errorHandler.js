function errorHandler(err, req, res, next) {
  console.error("Error", err);
  const pgErrorCodes = {
    23505: { status: 409, message: "Duplicate entry" },
    23503: { status: 400, message: "Foreign key constraint violation" },
    23502: { status: 400, message: "Required missing fields" },
    "22P02": { status: 400, message: "Invalid input syntax" },
  };
  // Handle psql errors
  if (err.code && pgErrorCodes[err.code]) {
    const { status, message } = pgErrorCodes[err.code];
    return res.status(status).json({ error: message, detail: err.detail });
  }
  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: err.message,
    });
  }
  // Default error
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}

export default errorHandler;
