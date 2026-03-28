import { query } from "../config/db.js";

class Post {
  // Get all posts with filters and pagination
  static async findAll(filters = {}) {
    const { limit, offset, status, userId, search, tag } = filters;
    let queryText = `
        SELECT posts.id,
         posts.title,
        posts.slug,
        posts.excerpt,
        posts.featured_image,
        posts.status,
        posts.view_count,
        posts.like_count,
        posts.published_at,
        posts.created_at,
        users.username AS author,
        users.avatar_url AS author_avatar,
        COUNT(DISTINCT comments.id) AS comment_count,
        json_agg(DISTINCT jsonb_build_object('id',tags.id,'name',tags.name)) FILTER (WHERE tags.id IS NOT NULL)
        AS tags FROM posts INNER JOIN users ON posts.user_id = users.id LEFT JOIN comments ON posts.id = comments.post_id LEFT JOIN post_tags ON posts.id = post_tags.post_id
        LEFT JOIN tags ON post_tags.tag_id = tags.id WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    // Add filters
    if (status) {
      paramCount++;
      query += `AND posts.status = $${paramCount}`;
      params.push(status);
    }
    if (userId) {
      paramCount++;
      query += `AND posts.user_id = $${paramCount}`;
      params.push(userId);
    }
    if (search) {
      paramCount++;
      query += `AND posts.search_vector @@ plainto_tsquery('english',$${paramCount})`;
      params.push(search);
    }
    if (tag) {
      paramCount++;
      query += `AND tags.slug = $${paramCount}`;
      params.push(tag);
    }
    query += `GROUP BY posts.id,users.username,users.avatar_url`;
    query += `ORDER BY posts.created_at DESC`;
    // Add pagination
    if (limit) {
      paramCount++;
      query += `LIMIT $${paramCount}`;
      params.push(limit);
    }
    if (offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);
    }
    const result = await query(queryText, params);
    return result.rows;
  }
  // Get total count for pagination
  static async count(filters = {}) {
    const { status, userId, search, tag } = filters;
    let queryText = `
        SELECT COUNT(DISTINCT posts.id) AS total FROM posts LEFT JOIN post_tags ON posts.id = post_tags.post_id LEFT JOIN tags ON post_tags.tag_id = tags.id WHERE 1=1`;
    const params = [];
    let paramCount = 0;
    if (status) {
      paramCount++;
      query += ` AND posts.status = $${paramCount}`;
      params.push(status);
    }

    if (userId) {
      paramCount++;
      query += ` AND posts.user_id = $${paramCount}`;
      params.push(userId);
    }

    if (search) {
      paramCount++;
      query += ` AND posts.search_vector @@ plainto_tsquery('english', $${paramCount})`;
      params.push(search);
    }

    if (tag) {
      paramCount++;
      query += ` AND tags.slug = $${paramCount}`;
      params.push(tag);
    }
    const result = await query(queryText, params);
    return parseInt(result.rows[0].total);
  }
  
  // Get single post by slug
  static async findBySlug(slug) {
    const result = await db.query(
      `SELECT 
        posts.*,
        users.username AS author,
        users.email AS author_email,
        users.avatar_url AS author_avatar,
        users.bio AS author_bio,
        json_agg(DISTINCT jsonb_build_object('id', tags.id, 'name', tags.name, 'slug', tags.slug))
          FILTER (WHERE tags.id IS NOT NULL) AS tags
       FROM posts
       INNER JOIN users ON posts.user_id = users.id
       LEFT JOIN post_tags ON posts.id = post_tags.post_id
       LEFT JOIN tags ON post_tags.tag_id = tags.id
       WHERE posts.slug = $1
       GROUP BY posts.id, users.username, users.email, users.avatar_url, users.bio`,
      [slug],
    );

    return result.rows[0];
  }
}