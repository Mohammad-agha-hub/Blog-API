import query from "../config/db.js";
import crypto from "crypto";

class passwordReset {
  // create password reset token
  static async create(userId) {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Hash token before storing
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 3600000);

    await query(
      `INSERT INTO password_resets(user_id,token,expires_at) VALUES ($1,$2,$3)`,
      [userId, hashedToken, expiresAt],
    );
    return token;
  }
  // Find valid password reset token
  static async findByToken(token) {
    // hash token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const result = await query(
      `SELECT pr.*,u.id as user_id,u.email,u.username FROM password_resets pr INNER JOIN users u ON pr.user_id = u.id WHERE p.token = $1 AND pr.expires_at > CURRENT_TIMESTAMP AND pr.used = false`,
      [hashedToken],
    );
    return result.rows[0];
  }
  // Mark token as used
  static async markAsUsed(id) {
    await db.query("UPDATE password_resets SET used = true WHERE id = $1", [
      id,
    ]);
  }
  // Delete all tokens for user
  static async deleteAllForUser(userId) {
    await db.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
  }

  // Clean up expired tokens (run periodically)
  static async deleteExpired() {
    const result = await db.query(
      "DELETE FROM password_resets WHERE expires_at < CURRENT_TIMESTAMP RETURNING id",
    );

    return result.rowCount;
  }
}

export default passwordReset;
