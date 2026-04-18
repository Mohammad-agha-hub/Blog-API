import crypto from 'crypto'

// CSRF protection (for cookie based sessions)

class CSRFProtection{
    constructor(){
        this.tokens = new Map()
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
