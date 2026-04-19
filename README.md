# Blog REST API

A production-ready RESTful API for a blog platform built with Node.js, Express, and PostgreSQL. Built with security-first principles including JWT authentication, role-based access control, rate limiting, and multiple layers of attack prevention.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (Access + Refresh tokens)
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize, xss-clean, hpp, compression

## Features

### Authentication & Authorization
- JWT-based authentication with short-lived access tokens (15 min) and long-lived refresh tokens (7 days)
- Refresh token rotation — old token is invalidated on every refresh, new one is issued
- Role-based access control with four roles: `user`, `author`, `moderator`, `admin`
- Account lockout after 5 failed login attempts (30 minute lock)
- Email verification requirement before publishing posts
- Logout from single device or all devices simultaneously

### Posts
- Full CRUD with slug-based URLs
- Draft / published / archived status system
- Full-text search using PostgreSQL `search_vector`
- Tag filtering, pagination, and sorting
- Like / unlike toggle
- Nested comments up to 5 levels deep using recursive CTE
- View count tracking
- Author and admin ownership checks on all write operations

### Security Layers
- **Helmet** — sets secure HTTP response headers automatically
- **CSRF protection** — token generated on login, validated on all state-changing requests with automatic cleanup of expired tokens
- **Rate limiting** — three tiers:
  - API routes: 100 requests / 15 minutes
  - Auth routes: 5 requests / 15 minutes
  - Sensitive operations (password change, account deletion): 3 requests / hour
- **NoSQL injection prevention** — strips MongoDB `$` and `.` operators from all input
- **XSS prevention** — cleans HTML from all input fields before it reaches your logic
- **HTTP Parameter Pollution prevention** — blocks duplicate query params except whitelisted ones (`page`, `limit`, `sort`, `fields`)
- **Suspicious pattern detection** — blocks SQL injection and script injection attempts in body and query params before they reach any route
- **IP filtering** — whitelist/blacklist support, admin routes locked to specific IPs
- **HTTPS enforcement** in production with automatic redirect
- **Request ID** on every request for end-to-end tracing across logs

### Reliability
- Structured JSON logging with 4 separate log files: app, error, security, auth
- Daily log rotation with automatic cleanup (14–90 days depending on log type)
- Graceful shutdown on SIGTERM — waits for DB pool to close
- Environment variable validation on startup — crashes loudly if required secrets are missing
- Body size limit (10kb) to prevent payload attacks
- Response compression on all routes

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | Login, receive tokens + CSRF token | Public |
| POST | `/refresh` | Rotate refresh token, get new pair | Public |
| POST | `/logout` | Logout current device | Public |
| POST | `/logout-all` | Logout all devices | Required |

### Users — `/api/users`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/me` | Get own profile | Required |
| PUT | `/me` | Update username or bio | Required |
| PUT | `/me/password` | Change password | Required + strict limit |
| DELETE | `/me` | Delete own account | Required + strict limit |
| GET | `/` | List all users with filters | Admin |
| GET | `/:id` | Get user by ID with post/comment stats | Admin |
| PUT | `/:id/role` | Update user role | Admin |
| PUT | `/:id/status` | Activate or deactivate user | Admin |
| DELETE | `/:id` | Delete user | Admin |

### Posts — `/api/posts`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List published posts with pagination | Public |
| GET | `/my` | List own posts (all statuses) | Required |
| GET | `/:slug` | Get single post | Public |
| POST | `/` | Create post | Author / Admin |
| PUT | `/:slug` | Update post | Author / Admin |
| DELETE | `/:slug` | Delete post | Author / Admin |
| POST | `/:slug/like` | Toggle like | Required |
| POST | `/:slug/comments` | Add comment or reply | Required |

### Tags — `/api/tags`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all tags with post counts | Public |
| GET | `/:slug` | Get tag by slug | Public |
| POST | `/` | Create tag | Admin |
| PUT | `/:slug` | Update tag | Admin |
| DELETE | `/:slug` | Delete tag | Admin |

### Comments — `/api/comments`
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| PUT | `/:id` | Edit comment | Comment author / Admin |
| DELETE | `/:id` | Delete comment | Comment author / Post author / Admin |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server and database status |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
git clone https://github.com/Mohammad-agha-hub/Blog-API
cd blog-api
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=blogdb
DB_USER=your_username
DB_PASSWORD=your_password

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_char_secret
JWT_REFRESH_SECRET=your_64_char_refresh_secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

BCRYPT_ROUNDS=10
HOME_IP_ADDRESS=your_ip_for_admin_access
```

> The app will refuse to start if `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_HOST`, or `DB_PASSWORD` are missing.

### Run

```bash
# Development
npm run dev

# Production
npm start
```

### Health Check

```
GET /api/health
→ { status: "healthy", database: "connected", timestamp: "..." }
```

## Project Structure

```
├── config/
│   └── db.js                 # PostgreSQL pool and transaction helper
├── middleware/
│   ├── auth.js               # authenticate, authorize, optionalAuth, requireVerified, checkOwnership
│   ├── advancedSecurity.js   # CSRF, IP filter, request ID, suspicious pattern detector
│   ├── security.js           # Rate limiters (api, auth, strict), sanitizers, HPP
│   ├── validation.js         # express-validator rules for all routes
│   └── errorHandler.js       # Centralized error handler with PostgreSQL error codes
├── models/
│   ├── User.js               # Auth, lockout, password, verification
│   ├── Post.js               # CRUD, likes, views, full-text search, tag joins
│   ├── Comment.js            # Nested comments with recursive CTE
│   ├── Tag.js                # Tag management with post counts
│   └── RefreshToken.js       # Token storage, rotation, cleanup
├── routes/
│   ├── auth.js               # register, login, refresh, logout, logout-all
│   ├── users.js              # profile, password, account, admin user management
│   ├── posts.js              # CRUD, likes, comments
│   ├── comments.js           # edit, delete
│   └── tags.js               # CRUD
├── utils/
│   ├── jwt.js                # Token generation and verification
│   ├── logger.js             # Winston logger with daily rotation
│   ├── pagination.js         # Paginate helper and response builder
│   ├── response.js           # Standardized ApiResponse class
│   └── asyncHandler.js       # Wraps async route handlers, passes errors to next()
├── logs/                     # Auto-created on first run, gitignored
└── index.js                  # App entry point, middleware stack, route mounting
```

## Roadmap

- [ ] Email verification on registration
- [ ] Password reset via email
- [ ] OAuth 2.0 (Google, GitHub)
- [ ] Image uploads with cloud storage
- [ ] Post bookmarks
- [ ] User follow system
- [ ] Notification system
- [ ] Admin dashboard
- [ ] API documentation with Swagger / Postman collection
- [ ] Unit and integration test suite
- [ ] Docker + docker-compose setup
- [ ] CI/CD pipeline

## Security Notes

- Review `logs/security.log` regularly for suspicious activity
- Admin routes are IP-restricted — set `HOME_IP_ADDRESS` in your env
- All passwords are hashed with bcrypt (10 rounds)
- CSRF tokens expire after 1 hour and are cleaned up automatically

## License

MIT
