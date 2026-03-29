import { query, transaction } from "../config/db.js";

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
      queryText += `AND posts.status = $${paramCount}`;
      params.push(status);
    }
    if (userId) {
      paramCount++;
      queryText += `AND posts.user_id = $${paramCount}`;
      params.push(userId);
    }
    if (search) {
      paramCount++;
      queryText += `AND posts.search_vector @@ plainto_tsquery('english',$${paramCount})`;
      params.push(search);
    }
    if (tag) {
      paramCount++;
      queryText += `AND tags.slug = $${paramCount}`;
      params.push(tag);
    }
    queryText += `GROUP BY posts.id,users.username,users.avatar_url`;
    queryText += `ORDER BY posts.created_at DESC`;
    // Add pagination
    if (limit) {
      paramCount++;
      queryText += `LIMIT $${paramCount}`;
      params.push(limit);
    }
    if (offset) {
      paramCount++;
      queryText += ` OFFSET $${paramCount}`;
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
      queryText += ` AND posts.status = $${paramCount}`;
      params.push(status);
    }

    if (userId) {
      paramCount++;
      queryText += ` AND posts.user_id = $${paramCount}`;
      params.push(userId);
    }

    if (search) {
      paramCount++;
      queryText += ` AND posts.search_vector @@ plainto_tsquery('english', $${paramCount})`;
      params.push(search);
    }

    if (tag) {
      paramCount++;
      queryText += ` AND tags.slug = $${paramCount}`;
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

  // Get post with comments (nested structure)
  static async findWithComments(slug) {
    const post = await this.findBySlug(slug);
    if (!post) return null;
    // Get comments with nested replies
    const commentsResult = await query(
      `WITH RECURSIVE comment_tree AS (
        SELECT c.id,
        c.post_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.is_edited,
        c.created_at,
        u.username,
        u.avatar_url,
        1 AS depth,
        ARRAY[c.id] AS path FROM comments c INNER JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 AND c.parent_id IS NULL UNION ALL
        SELECT c.id,
        c.post_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.is_edited,
        c.created_at,
        u.username,
        u.avatar_url,
        ct.depth + 1,
        ct.path || c.id)
        FROM comments c
        INNER JOIN users u ON c.user_id = u.id INNER JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE ct.depth <5)
        SELECT * FROM comment_tree ORDER BY path`,
      [post.id],
    );
    post.comments = commentsResult.rows;
    return post;
  }

  // Create post with tags
  static async createPost(postData, tagSlugs = []) {
    return await transaction(async (client) => {
      // Generate slug from title
      const slug = postData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      // Insert post
      const postResult = await client.query(
        `INSERT INTO posts (user_id, title, slug, content, excerpt, featured_image, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          postData.user_id,
          postData.title,
          slug,
          postData.content,
          postData.excerpt || null,
          postData.featured_image || null,
          postData.status || "draft",
          postData.status === "published" ? new Date() : null,
        ],
      );
      const post = postResult.rows[0];
      // Add tags
      if (tagSlugs.length > 0) {
        for (const tagSlug of tagSlugs) {
          const tagResult = await client.query(
            "SELECT id FROM tags WHERE slug = $1",
            [tagSlug],
          );
          if (tagResult.rows.length > 0) {
            await client.query(
              "INSERT INTO post_tags(post_id,tag_id) VALUES ($1,$2)",
              [post.id, tagResult.rows[0].id],
            );
          }
        }
      }
      return post;
    });
  }

  // Update post
  static async updatePost(slug, updates, tagSlugs = null) {
    return await transaction(async (client) => {
      const fields = [];
      const values = [];
      let paramsCount = 0;
      // Dynamic update query
      if (updates.title) {
        paramsCount++;
        fields.push(`title = $${paramsCount}`);
        values.push(updates.title);
        // update slug if title changes
        const newSlug = updates.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        paramsCount++;
        fields.push(`slug = $${paramsCount}`);
        values.push(newSlug);
      }
      if (updates.content !== undefined) {
        paramsCount++;
        fields.push(`content = $${paramsCount}`);
        values.push(updates.content);
      }
      if (updates.excerpt !== undefined) {
        paramsCount++;
        fields.push(`excerpt = $${paramsCount}`);
        values.push(updates.excerpt);
      }
      if (updates.featured_image !== undefined) {
        paramsCount++;
        fields.push(`featured_image = $${paramsCount}`);
        values.push(updates.featured_image);
      }

      if (updates.status) {
        paramsCount++;
        fields.push(`status = $${paramsCount}`);
        values.push(updates.status);

        // Set published_at if publishing
        if (updates.status === "published") {
          paramsCount++;
          fields.push(`published_at = $${paramsCount}`);
          values.push(new Date());
        }
      }
      if (fields.length === 0) {
        throw new Error("No fields to update");
      }
      paramsCount++;
      values.push(slug);
      const queryText = `
        UPDATE posts 
        SET ${fields.join(", ")}
        WHERE slug = $${paramsCount}
        RETURNING *
      `;
      const result = await client.query(queryText, values);
      if (result.rows.length === 0) {
        throw new Error("Post not found");
      }

      const post = result.rows[0];
      // Update tags if provided
      if (tagSlugs !== null) {
        // Remove existing tags
        await client.query("DELETE FROM post_tags WHERE post_id = $1", [
          post.id,
        ]);
        // Add new tags
        for (const tagSlug of tagSlugs) {
          const tagResult = await client.query(
            "SELECT id FROM tags WHERE slug = $1",
            [tagSlug],
          );
          if (tagResult.rows.length > 0) {
            await client.query(
              "INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)",
              [post.id, tagResult.rows[0].id],
            );
          }
        }
      }
      return post;
    });
  }

  // Delete post
  static async delete(slug) {
    const result = await db.query(
      "DELETE FROM posts WHERE slug = $1 RETURNING id",
      [slug],
    );

    return result.rows[0];
  }
  // Increment view count
  static async incrementViews(slug) {
    await db.query(
      "UPDATE posts SET view_count = view_count + 1 WHERE slug = $1",
      [slug],
    );
  }
  // Like/Unlike post
  static async toggleLike(slug, increment = true) {
    const operator = increment ? "+" : "-";
    const result = await db.query(
      `UPDATE posts SET like_count = like_count ${operator} 1 WHERE slug = $1 RETURNING like_count`,
      [slug],
    );

    return result.rows[0];
  }
}

export default Post;