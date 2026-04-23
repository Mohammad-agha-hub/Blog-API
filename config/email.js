import 'dotenv/config'

export default {
 service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // App password for Gmail
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Blog API',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@blogapi.com'
  }
}

FRONTEND_URL='http://localhost:3000'