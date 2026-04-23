import express from "express";
import RefreshToken from "../model/RefreshToken.js";
import User from "../model/User.js";
import JWTService from "../utils/jwt.js";
import crypto from 'crypto'
import {
  registerValidation,
  loginValidation,

} from "../middleware/validation.js";
import {authenticate} from '../middleware/auth.js'
import RefreshToken from "../model/RefreshToken.js";
import passwordReset from "../model/passwordReset.js";
import emailService from "../utils/emailService.js";
import logger from "../utils/logger.js";
import {authLimiter} from '../middleware/security.js'
import { csrfProtection } from "../middleware/advancedSecurity.js";

const router = express.Router();


// POST /api/auth/register - Register new user
router.post("/register",authLimiter, registerValidation, async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }
    // Check if username taken
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already taken",
      });
    }
    // Create user
    const user = await User.createUser({ username, email, password });
    // generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await User.setVerificationToken(user.id,verificationToken);
    // send verification email
    try {
      await emailService.sendVerificationEmail(user,verificationToken);

    } catch (error) {
      logger.error("Failed to send verification email", emailError, {
        userId: user.id,
      });
    }
    // Generate tokens
    const { accessToken, refreshToken } = JWTService.generateTokenPair(user);
    // Save refresh token to db
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await RefreshToken.create(user.id, refreshToken, expiresAt, req.ip);
     logger.info("register", user.id, true, { email, username });
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - User login
router.post("/login",authLimiter, loginValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    // Check if account is locked
    const isLocked = await User.isAccountLocked(user.id);
    if (isLocked) {
      return res.status(403).json({
        success: false,
        message:
          "Account is temporarily locked due to multiple failed login attempts. Try again later.",
      });
    }
    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }
    // Verify password
    const isPasswordValid = await User.verifyPassword(
      password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      // Increment failed attempts
      await User.incrementFailedAttempts(user.id);

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    // Reset failed attempts on successful login
    await User.resetFailedLogins(user.id);

    // Update last login
    await User.updateLastLogin(user.id);
    // Generate tokens
    const { accessToken, refreshToken } = JWTService.generateTokenPair(user);
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create(user.id, refreshToken, expiresAt, req.ip);
    const csrfToken = csrfProtection.generateToken(req);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: user.is_verified,
        },
        accessToken,
        refreshToken,
        csrfToken,
      },
    });
  } catch (error) {
    next(error);
  }
});
// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Find user by verification token
    const user = await User.findByVerificationToken(token);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    // Verify email
    await User.verifyEmail(user.id);
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
      logger.error('Failed to send welcome email', emailError, { userId: user.id });
    }
    
    logger.info('Email verified', { userId: user.id, email: user.email });
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isVerified: true
        }
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, authenticate, async (req, res, next) => {
  try {
    if (req.user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    // Get full user data
    const user = await User.findById(req.user.id);
    
    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await User.setVerificationToken(user.id, verificationToken);
    
    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken);
    
    logger.info('Verification email resent', { userId: user.id });
    
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', strictLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findByEmail(email);
    
    // Always return success even if user doesn't exist (security)
    if (!user) {
      logger.security('Password reset attempted for non-existent email', { email });
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent'
      });
    }
    
    // Delete any existing reset tokens
    await PasswordReset.deleteAllForUser(user.id);
    
    // Create new reset token
    const resetToken = await PasswordReset.create(user.id);
    
    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user, resetToken);
      logger.info('Password reset email sent', { userId: user.id });
    } catch (emailError) {
      logger.error('Failed to send password reset email', emailError, { userId: user.id });
      throw emailError;
    }
    
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent'
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }
    
    // Find reset token
    const resetRecord = await PasswordReset.findByToken(token);
    
    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Update password
    await User.updatePassword(resetRecord.user_id, newPassword);
    
    // Mark token as used
    await passwordReset.markAsUsed(resetRecord.id);
    
    // Invalidate all refresh tokens (logout from all devices)
    await RefreshToken.deleteAllByUserId(resetRecord.user_id);
    
    // Send confirmation email
    try {
      const user = await User.findById(resetRecord.user_id);
      await emailService.sendPasswordChangedEmail(user);
    } catch (emailError) {
      logger.error('Failed to send password changed email', emailError);
    }
    
    logger.info('Password reset successful', { userId: resetRecord.user_id });
    
    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Refresh access token
router.post("/refresh",authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }
    // Verify refresh token
    const decoded = JWTService.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
    // Check if refresh token exists in database
    const tokenRecord = await RefreshToken.findByToken(refreshToken);
    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }
    await RefreshToken.deleteByToken(refreshToken);

    // Generate new access token
    const newAccessToken = JWTService.generateAccessToken({
      userId: tokenRecord.user_id,
      username: tokenRecord.username,
      email: tokenRecord.email,
      role: tokenRecord.role,
    });
    const newRefreshToken = JWTService.generateRefreshToken({userId:tokenRecord.user_id})

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7)
    await RefreshToken.create(tokenRecord.user_id,newRefreshToken,expiresAt,req.ip)
    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken:newRefreshToken
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Logout user
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.deleteByToken(refreshToken);
    }

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout-all - Logout from all devices
router.post("/logout-all", authenticate, async (req, res, next) => {
  try {
    // This would require authentication middleware (we'll add in next section)
    const userId = req.user?.id; // From auth middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    await RefreshToken.deleteAllByUserId(userId);

    res.json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
