import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import {pool} from './config/db.js'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import tagRoutes from './routes/tags.js'
import commentRoutes from './routes/comments.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()
const PORT = process.env.PORT || 3000;

// Security middlewares
app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Blog API',
    version: '1.0.0',
    description: 'Complete RESTful API for a blog platform',
    endpoints: {
      posts: '/api/posts',
      tags: '/api/tags',
      comments: '/api/comments',
      health: '/api/health'
    }
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.use("/api/posts", postRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/auth", authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.url
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n Blog API running on http://localhost:${PORT}`);
  console.log('\n API Documentation:');
  console.log('─'.repeat(50));
  console.log('\nUsers:')
   console.log("POST   /api/auth/register");
   console.log("POST   /api/auth/login");
   console.log("POST   /api/auth/refresh");
   console.log("POST   /api/auth/logout");
   console.log("POST   /api/auth/logout-all");
  console.log('\nPosts:');
  console.log('  GET    /api/posts');
  console.log('  GET    /api/posts/:slug');
  console.log('  POST   /api/posts');
  console.log('  PUT    /api/posts/:slug');
  console.log('  DELETE /api/posts/:slug');
  console.log('  POST   /api/posts/:slug/like');
  console.log('  POST   /api/posts/:slug/comments');
  console.log('\nTags:');
  console.log('  GET    /api/tags');
  console.log('  GET    /api/tags/:slug');
  console.log('  POST   /api/tags');
  console.log('  PUT    /api/tags/:slug');
  console.log('  DELETE /api/tags/:slug');
  console.log('\nComments:');
  console.log('  PUT    /api/comments/:id');
  console.log('  DELETE /api/comments/:id');
  console.log('\n' + '─'.repeat(50));
});

process.on("SIGTERM", async () => {
  console.log("\nSIGTERM received, shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

