import { query } from "../config/db.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

class User {
  // Create new user
  static async createUser({ username, email, password, role = "user" }) {
    // Hash pass
    const hashed_password = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      "INSERT INTO users(username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,username,email,role,isVerified,created_at",
      [username, email, hashed_password, role],
    );
    return result.rows[0];
  }
  // Find user by email
  static async findByEmail(email) {
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);

    return result.rows[0];
  }

  // Find user by username
  static async findByUsername(username) {
    const result = await query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    return result.rows[0];
  }

  // Find user by ID (without password)
  static async findById(id) {
    const result = await query(
      `SELECT id, username, email, role, is_verified, is_active, 
              last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id],
    );

    return result.rows[0];
  }
  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update last login
  static async updateLastLogin(id) {
    await query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [id],
    );
  }

  // Increment failed login attempts
  static async incrementFailedAttempts(id) {
    const result = await query(
      "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1 RETURNING failed_login_attempts",
      [id],
    );
    const attempts = result.rows[0].failed_login_attempts;
    // Lock account after 5 failed attempts (30 min)
    if (attempts >= 5) {
      await query(
        `UPDATE users SET locked_until = CURRENT_TIMESTAMP + INTERVAL '30 minutes' WHERE id = $1`,
        [id],
      );
    }
    return attempts;
  }
  // Reset failed login attempts
  static async resetFailedLogins(id) {
    await query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [id],
    );
  }
  // Check if account is locked
  static async isAccountLocked(id) {
    const result = await query(`SELECT locked_until FROM users WHERE id = $1`, [
      id,
    ]);
    if (!result.rows[0].locked_until) return false;
    const lockedUntil = new Date(result.rows[0].locked_until);
    const now = new Date();
    if (now < lockedUntil) {
      return true;
    } else {
      // Lock period expired,reset
      await this.resetFailedLogins(id);
      return false;
    }
  }
  // Update password
  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      password_hash,
      id,
    ]);
  }
  // Verify email
  static async verifyEmail(id) {
    await query(
      "UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1",
      [id],
    );
  }

  // Set verification token
  static async setVerificationToken(id, token) {
    await query("UPDATE users SET verification_token = $1 WHERE id = $2", [
      token,
      id,
    ]);
  }
  // Find by verification token
  static async findByVerificationToken(token) {
    const result = await query(
      "SELECT * FROM users WHERE verification_token = $1",
      [token],
    );

    return result.rows[0];
  }
}

export default User;
