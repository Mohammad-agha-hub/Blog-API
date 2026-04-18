-- Blog API Schema
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','author','admin')),
    bio TEXT,
    isVerified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_ip VARCHAR(50)
);

-- Password reset tokens
CREATE TABLE password_resets(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts Table
CREATE TABLE posts(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    featured_image VARCHAR(255),
    status VARCHAR(20) DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector
);

-- Comments Table
CREATE TABLE comments(
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tags Table
CREATE TABLE tags(
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post tags junction table
CREATE TABLE post_tags(
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id,tag_id)
);
CREATE TABLE post_likes (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)  -- composite key prevents duplicates at DB level
);
-- Create indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag_id ON post_tags(tag_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

-- Full text search index
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_post_search_vector() 
RETURNS TRIGGER AS $$ BEGIN
NEW.search_vector := to_tsvector('english',COALESCE(NEW.title,'') || '' || COALESCE(NEW.content,''));
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
CREATE TRIGGER trig_update_post_search_vector
    BEFORE INSERT OR UPDATE OF title,content ON posts FOR EACH ROW EXECUTE FUNCTION 
    update_post_search_vector();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN
NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trig_users_updated_at 
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trig_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trig_comments_updated_at 
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trig_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  
-- Sample data if you want to use
INSERT INTO users (username, email, password_hash, role, bio) VALUES
  ('johndoe', 'john@example.com', 'hashed_password_1', 'admin', 'Admin user'),
  ('janedoe', 'jane@example.com', 'hashed_password_2', 'author', 'Tech writer and blogger'),
  ('bobsmith', 'bob@example.com', 'hashed_password_3', 'user', 'Reader and commenter');
INSERT INTO posts (user_id, title, slug, content, excerpt, status, published_at) VALUES
  (1, 'Introduction to PostgreSQL', 'introduction-to-postgresql', 
   'PostgreSQL is a powerful, open-source object-relational database system...', 
   'Learn the basics of PostgreSQL', 'published', CURRENT_TIMESTAMP),
  (2, 'Node.js Best Practices', 'nodejs-best-practices',
   'Here are some essential best practices for Node.js development...',
   'Essential tips for Node.js developers', 'published', CURRENT_TIMESTAMP),
  (2, 'Draft Article', 'draft-article',
   'This is a work in progress...',
   'Coming soon', 'draft', NULL);
INSERT INTO tags (name, slug, description) VALUES
  ('PostgreSQL', 'postgresql', 'Database management system'),
  ('Node.js', 'nodejs', 'JavaScript runtime'),
  ('Backend', 'backend', 'Server-side development'),
  ('Tutorial', 'tutorial', 'Educational content');
INSERT INTO post_tags (post_id, tag_id) VALUES
  (1, 1), (1, 4),
  (2, 2), (2, 3), (2, 4);
INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, 'Great article! Very helpful.'),
  (1, 3, 'Thanks for sharing this.'),
  (2, 1, 'Nice work!');