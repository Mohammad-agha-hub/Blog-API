import crypto from 'crypto'

// CSRF protection (for cookie based sessions)

class CSRFProtection{
    constructor(){
        this.tokens = new Map()
        setInterval(()=>{
          const now = Date.now();
          for(const [userId,data] of this.tokens.entries()){
            if(now>data.expires){
              this.tokens.delete(userId)
            }
          }
        },15*60*1000)
      }

    generateToken(req){
        const token = crypto.randomBytes(32).toString('hex')
        const userId = req.user?.id || req.ip;
        this.tokens.set(userId,{token,expires:Date.now() + 3600000}) // 1 hour
        return token;
    }
    validateToken(req,token){
        const userId = req.user?.id || req.ip;;
        const stored = this.tokens.get(userId)
        if(!stored) return false;
        if(Date.now() > stored.expires){
            this.tokens.delete(userId);
            return false
        }
        return stored.token === token;
    }
    middleware(){
        return (req,res,next)=>{
            if(['POST','PUT','DELETE','PATCH'].includes(req.method)){
                const token = req.headers['x-csrf-token'] || req.body._csrf
            if(!this.validateToken(req,token)){
                return res.status(403).json({
                    success:false,
                    message:'Invalid CSRF token'
                })
            }
            }
            next()
        }
    }
}

// Request ID for tracking
const requestId = (req,res,next)=>{
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id',req.id)
    next()
};

// Security headers
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS protection (legacy, but still good)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  next();
};

// IP whitelist/blacklist
class IPFilter{
    constructor(){
        this.blacklist = new Set();
        this.whitelist = new Set();
    }
    addToBlacklist(ip){
        this.blacklist.add(ip)
    }
    addToWhitelist(ip){
        this.whitelist.add(ip)
    }
    middleware(){
        return (req,res,next)=>{
            const ip = req.ip || req.connection.remoteAddress
            if(this.blacklist.has(ip)){
               return res.status(403).json({
                 success: false,
                 message: "Access denied",
               }); 
            }
            if (this.whitelist.size > 0 && !this.whitelist.has(ip)){
               return res.status(403).json({
                 success: false,
                 message: "Access denied",
               }); 
            }
            next()
        }
    }
}

// Detect suspicious patterns
const suspiciousPatternDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
  ];
  
  const checkString = (str) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  const checkObject = (obj) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null && checkObject(value)) {
        return true;
      }
    }
    return false;
  };
  
  // Check body, query, and params
  if (req.body && checkObject(req.body)) {
    console.warn(`Suspicious pattern detected in request body from ${req.ip}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid request'
    });
  }
  
  if (req.query && checkObject(req.query)) {
    console.warn(`Suspicious pattern detected in query from ${req.ip}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid request'
    });
  }
  
  next();
};

const csrfProtection = new CSRFProtection();
const ipFilter = new IPFilter();

export {
    csrfProtection,requestId,suspiciousPatternDetector,securityHeaders,ipFilter,
}