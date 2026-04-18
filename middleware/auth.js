import JWTService from "../utils/jwt.js";
import User from "../models/User.js";

// Authenticate user from jwt token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }
    // Extract token
    const token = authHeader.substring(7); // remove bearer
    // verify token
    const decoded = JWTService.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    // Get user from db (to ensure still exists and active)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }
    // attach user to request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = JWTService.verifyAccessToken(token);

    if (decoded) {
      const user = await User.findById(decoded.userId);
      if (user && user.is_active) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: user.is_verified,
        };
      }
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Authorization middleware - check roles
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }
    next();
  };
};

// Check if user is verified
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required",
    });
  }

  next();
};

// Check if user owns the resource
const checkOwnership = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Admin can access everything
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId =
      req[resourceUserIdField] || req.body[resourceUserIdField];

    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
};

export {
  authenticate,
  optionalAuth,
  authorize,
  requireVerified,
  checkOwnership,
};
