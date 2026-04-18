import { query } from "../config/db.js";

class Comment {
  // Get existing comment
  static async findExisting(id){
    const result = await query('SELECT * FROM comments WHERE id = $1',[id])
    if(result.rows.length === 0){
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }
    return result.rows;
  }
  // Get comments for a post
  static async findByPost(postId) {
    if (!postId) {
      throw new Error("No post Id provided!");
    }
    const result = await query(
      `SELECT comments.*,users.username,users.avatar_url FROM comments INNER JOIN users ON comments.user_id = users.id WHERE comments.post_id = $1 ORDER BY comments.created_at DESC`,
      [postId],
    );
    return result.rows;
  }
  // Get comment with post info
  static async getCommentWithPostInfo(id){
    const result = await query(`SELECT comments.*,posts.user_id as post_author_id FROM comments INNER JOIN posts ON comments.post_id = posts.id WHERE comments.id = $1`,[id])
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }
    return result.rows[0];
  }
  // Create comment
  static async createComment({ post_id, user_id, content, parent_id = null }) {
    const result = await query(
      `INSERT INTO comments (post_id,user_id,content,parent_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [post_id, user_id, content, parent_id],
    );
    return result.rows[0];
  }

  // Update comment
  static async updateComment(id, content) {
    const result = await query(
      `UPDATE comments SET content = $1,is_edited = true WHERE id = $2 RETURNING *`,
      [content, id],
    );
    if(!result.rows[0]){
      throw new Error('Comment not found!')
    }
  }
  // Delete comment
  static async deleteComment(id) {
    const result = await query(
      "DELETE FROM comments WHERE id = $1 RETURNING id",
      [id],
    );

    return result.rows[0];
  }
}

export default Comment;