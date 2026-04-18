import rateLimit from "express-rate-limit";
import xss from 'xss-clean'
import hpp from "hpp";
import mongoSanitize from 'express-mongo-sanitize'
// rate limiting for authentication routes
const authLimiter = rateLimit({
    windowMs: 15*60*1000, //  15 minutes
    max:5, // 5 requests per window
    message:{
        success:false,
        message:'Too many authentication attempts, please try again after 15 minutes'
    },
    standardHeaders:true,
    legacyHeaders:false
})

// Rate limiting for api routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 *1000,
    max: 100,
    message:{
        success:false,
        message:"Too many requests, please try again later"
    },
    standardHeaders:true,
    legacyHeaders:false
})

// strict rate limiting for sensitive operations
const strictLimiter = rateLimit({
    windowMs: 60*60*1000,
    max:3,
    message:{
        success:false,
        message:'Too many attempts, try again after an hour'
    },
    standardHeaders:true,
    legacyHeaders:false
})

// data sanitization against nosql injection
const sanitizeData = () =>{
    return mongoSanitize({replaceWith:'_'})
}

// data sanitization against xss
const preventXSS = ()=>{
    return xss()
}

// Prevent http parameter pollution
const preventHPP = ()=>{
    return hpp({
        whitelist:['page','limit','sort','fields'] // allow these params to be duplicated
    })
}

export {
    apiLimiter,
    authLimiter,
    strictLimiter,
    sanitizeData,
    preventHPP,
    preventXSS
}