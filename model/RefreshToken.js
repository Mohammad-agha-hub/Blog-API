import { query } from "../config/db.js";

class RefreshToken {
  // Save refresh token
  static async create(userId, token, expiresAt, ip = null) {
    const result = await query(
      `INSERT INTO refresh_tokens (user_id,token,expires_at,created_by_ip) VALUES ($1,$2,$3,$4) RETURNING *`,
      [userId, token, expiresAt, ip],
    );
    return result.rows[0];
  }

  // Find refresh token
  static async findByToken(token) {
    const result = await query(
      `SELECT rt.*,u.id as user_id,u.username,u.email,u.role FROM refresh_tokens rt INNER JOIN users u ON rt.user_id = u.id WHERE rt.token = $1 AND rt.expires_at > CURRENT_TIMESTAMP`,
      [token],
    );
    return result.rows[0];
  }

  // Delete refresh token (logout)
  static async deleteByToken(token) {
    await query("DELETE FROM refresh_tokens WHERE token = $1", [token]);
  }

  // Delete all user's refresh tokens (logout from all devices)
  static async deleteAllByUserId(userId) {
    await query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
  }

  // Clean up expired tokens (run periodically)
  static async deleteExpired() {
    const result = await query(
      "DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP RETURNING id",
    );
    return result.rowCount;
  }
}

export default RefreshToken;
