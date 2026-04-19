import express from "express";
import User from "../model/User.js";
import {
  changePasswordValidation,
} from "../middleware/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {strictLimiter} from '../middleware/security.js'

const router = express.Router();


// GET /api/users/me - Get current user profile
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me - Update current user profile
router.put("/me", authenticate, async (req, res, next) => {
  try {
    const { username, bio } = req.body;

    // Only allow updating certain fields
    const updates = {};
    if (username) updates.username = username;
    if (bio !== undefined) updates.bio = bio;

    // Check if username is taken (if changing)
    if (username) {
      const existing = await User.findByUsername(username);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({
          success: false,
          message: "Username already taken",
        });
      }
    }
    // Update user
    const result = await query(
      `UPDATE users SET username = COALESCE($1,username), bio = COALESCE($2, bio),
           updated_at = CURRENT_TIMESTAMP WHERE id = $3
       RETURNING id, username, email, role, bio, is_verified, created_at, updated_at`,
      [updates.username, updates.bio, req.user.id],
    );
    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me/password - Change password
router.put(
  "/me/password",
  authenticate,
  strictLimiter,
  changePasswordValidation,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password hash
      const user = await User.findByEmail(req.user.email);

      // Verify current password
      const isValid = await User.verifyPassword(
        currentPassword,
        user.password_hash,
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Update password
      await User.updatePassword(req.user.id, newPassword);

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/users/me - Delete own account
router.delete("/me", authenticate, strictLimiter, async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation required",
      });
    }

    // Verify password
    const user = await User.findByEmail(req.user.email);
    const isValid = await User.verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Delete user (cascade will delete related data)
    await query("DELETE FROM users WHERE id = $1", [req.user.id]);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes - manage all users
// GET /api/users - Get all users (admin only)
router.get("/", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;

    const offset = (page - 1) * limit;

    let queryText = `
      SELECT id, username, email, role, is_verified, is_active, 
             last_login, created_at, updated_at
      FROM users
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      queryText += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (isActive !== undefined) {
      paramCount++;
      queryText += ` AND is_active = $${paramCount}`;
      params.push(isActive === "true");
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Get total count
    const countResult = await query("SELECT COUNT(*) FROM users");
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Get user by ID (admin only)
router.get("/:id", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user statistics
    const stats = await query(
      `SELECT 
        (SELECT COUNT(*) FROM posts WHERE user_id = $1) as post_count,
        (SELECT COUNT(*) FROM comments WHERE user_id = $1) as comment_count
       FROM users WHERE id = $1`,
      [id],
    );

    res.json({
      success: true,
      data: {
        user,
        stats: stats.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id/role - Update user role (admin only)
router.put(
  "/:id/role",
  authenticate,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const validRoles = ["user", "moderator", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be one of: " + validRoles.join(", "),
        });
      }

      // Prevent changing own role
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Cannot change your own role",
        });
      }

      const result = await query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, email, role`,
        [role, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "User role updated successfully",
        data: { user: result.rows[0] },
      });
    } catch (error) {
      next(error);
    }
  },
);

// PUT /api/users/:id/status - Activate/deactivate user (admin only)
router.put(
  "/:id/status",
  authenticate,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
      }

      // Prevent deactivating own account
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Cannot change your own account status",
        });
      }

      const result = await query(
        `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, email, is_active`,
        [isActive, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: `User ${isActive ? "activated" : "deactivated"} successfully`,
        data: { user: result.rows[0] },
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/users/:id - Delete user (admin only)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Prevent deleting own account
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      const result = await db.query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;