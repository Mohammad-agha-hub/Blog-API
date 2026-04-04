import { query } from "../config/db.js";

class Tag {
  // Get all tags with post counts
  static async findAllTags() {
    const result = await query(
      "SELECT tags.*,COUNT(post_tags.post_id) AS post_count FROM tags LEFT JOIN post_tags ON tags.id = post_tags.tag_id GROUP BY tags.id ORDER BY post_count DESC,tags.name ASC",
    );
    return result.rows;
  }

  // Get tag by slug
  static async findTagBySlug(slug) {
    const result = await query(
      "SELECT tags.*,COUNT(post_tags.post_id) as post_count FROM tags LEFT JOIN post_tags ON post_tags.tag_id = tags.id WHERE tags.slug = $1 GROUP BY tags.id",
      [slug],
    );
    return result.rows[0];
  }

  // Create tag
  static async createTag({ name, description }) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g,"");

    const result = await query(
      `INSERT INTO tags (name, slug, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, slug, description || null],
    );

    return result.rows[0];
  }
  // Update tag
  static async updateTag(slug, { name, description }) {
    const newSlug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null;
    
    const result = await query(
      `UPDATE tags
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description)
       WHERE slug = $4
       RETURNING *`,
      [name, newSlug, description || null, slug]
    );
    
    return result.rows[0];
  }
  
  // Delete tag
  static async deleteTag(slug) {
    const result = await query(
      'DELETE FROM tags WHERE slug = $1 RETURNING id',
      [slug]
    );
    
    return result.rows[0];
  }
}

export default Tag;