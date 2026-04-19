import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import {pool} from './config/db.js'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import tagRoutes from './routes/tags.js'
import commentRoutes from './routes/comments.js'
import userRoutes from './routes/users.js'
import errorHandler from './middleware/errorHandler.js'
import { apiLimiter,sanitizeData,preventHPP,preventXSS } from './middleware/security.js'
import { requestId,suspiciousPatternDetector,ipFilter, csrfProtection } from './middleware/advancedSecurity.js'

const app = express()
const PORT = process.env.PORT || 3000;
const required = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DB_HOST", "DB_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1); // crash loudly instead of running broken
  }
}
// Trust proxy (for rate limiting behind proxies)
app.set('trust proxy',1)

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`)
        }
        next()
    })
}


// Request id
app.use(requestId)


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
else{
  app.use(morgan('combined'))
}

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression())
// Data sanitization
app.use(sanitizeData())
app.use(preventHPP())
app.use(preventXSS())

// Suspicious pattern detection
app.use(suspiciousPatternDetector)

// Rate limiting
app.use('/api/',apiLimiter)


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
// Block a known bad actor
// ipFilter.addToBlacklist('123.45.67.89');

if (process.env.HOME_IP_ADDRESS) {
  ipFilter.addToWhitelist(process.env.HOME_IP_ADDRESS);
}

app.use('/api/admin', ipFilter.middleware());
app.use("/api/posts", postRoutes);
app.use("/api/tags",csrfProtection.middleware(), tagRoutes);
app.use("/api/comments",csrfProtection.middleware(), commentRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/users',userRoutes)
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.url
  });
});


// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n Blog API running on http://localhost:${PORT}`);
  console.log("\n API Documentation:");
  console.log("─".repeat(50));

  console.log("\nAuth:");
  console.log("  POST   /api/auth/register");
  console.log("  POST   /api/auth/login");
  console.log("  POST   /api/auth/refresh");
  console.log("  POST   /api/auth/logout");
  console.log("  POST   /api/auth/logout-all");

  console.log("\nUsers:");
  console.log("  GET    /api/users/me");
  console.log("  PUT    /api/users/me");
  console.log("  PUT    /api/users/me/password");
  console.log("  DELETE /api/users/me");
  console.log("  GET    /api/users              (admin)");
  console.log("  GET    /api/users/:id          (admin)");
  console.log("  PUT    /api/users/:id/role     (admin)");
  console.log("  PUT    /api/users/:id/status   (admin)");
  console.log("  DELETE /api/users/:id          (admin)");

  console.log("\nPosts:");
  console.log("  GET    /api/posts");
  console.log("  GET    /api/posts/my");
  console.log("  GET    /api/posts/:slug");
  console.log("  POST   /api/posts              (author/admin)");
  console.log("  PUT    /api/posts/:slug        (author/admin)");
  console.log("  DELETE /api/posts/:slug        (author/admin)");
  console.log("  POST   /api/posts/:slug/like");
  console.log("  POST   /api/posts/:slug/comments");

  console.log("\nTags:");
  console.log("  GET    /api/tags");
  console.log("  GET    /api/tags/:slug");
  console.log("  POST   /api/tags               (admin)");
  console.log("  PUT    /api/tags/:slug         (admin)");
  console.log("  DELETE /api/tags/:slug         (admin)");

  console.log("\nComments:");
  console.log("  PUT    /api/comments/:id");
  console.log("  DELETE /api/comments/:id");

  console.log("\n" + "─".repeat(50));
});

process.on("SIGTERM", async () => {
  console.log("\nSIGTERM received, shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

