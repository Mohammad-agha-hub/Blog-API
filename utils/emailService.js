import nodemailer from 'nodemailer'
import email from '../config/email.js'
import logger from './logger.js'

class EmailService{
    constructor(){
        this.transporter = nodemailer.createTransport({
            host:email.host,
            port:email.port,
            secure:email.secure,
            auth:email.auth
        })
    }
    async sendEmail({to,subject,html,text}){
        try {
            const mailOptions = {
                from: `${email.from.name} <${email.from.address}>`,
                to,
                subject,
                html,
                text
            };
            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent successfully',{
                to,
                subject,
                messageId:info.messageId
            })
            return {success:true,messageId:info.messageId}
        } catch (error) {
            logger.error("Email sending failed", error, { to, subject });
            throw error;
        }
    }
    async sendVerificationEmail(user,token){
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Blog API!</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.username},</h2>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Blog API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const text = `
      Welcome to Blog API!
      
      Hi ${user.username},
      
      Thank you for registering. Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, please ignore this email.
    `;
    return await this.sendEmail({
        to:user.email,
        subject:'Verify your email address',
        html,
        text
    })
    }
    async sendPasswordResetEmail(user,token){
       const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

       const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.username},</h2>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #EF4444;">${resetUrl}</p>
            <div class="warning">
              <strong> Security Note:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password won't change until you access the link above</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 Blog API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

       const text = `
      Password Reset Request
      
      Hi ${user.username},
      
      We received a request to reset your password. Click the link below to reset it:
      
      ${resetUrl}
      
      Security Note:
      - This link will expire in 1 hour
      - If you didn't request this, please ignore this email
      - Your password won't change until you access the link above
    `;

       return await this.sendEmail({
         to: user.email,
         subject: "Password Reset Request",
         html,
         text,
       }); 
    }
    async sendPasswordChangedEmail(user){
       const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.username},</h2>
            <p>Your password has been changed successfully.</p>
            <p>If you didn't make this change, please contact us immediately at support@blogapi.com</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Blog API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

       const text = `
      Password Changed Successfully
      
      Hi ${user.username},
      
      Your password has been changed successfully.
      
      If you didn't make this change, please contact us immediately at support@blogapi.com
      
      Time: ${new Date().toLocaleString()}
    `;

       return await this.sendEmail({
         to: user.email,
         subject: "Password Changed Successfully",
         html,
         text,
       }); 
    }
    async sendWelcomeEmail(user){
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Blog API! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.username},</h2>
            <p>Your email has been verified successfully!</p>
            <p>You can now enjoy all features of our platform:</p>
            <ul>
              <li>Create and publish blog posts</li>
              <li>Comment on posts</li>
              <li>Like and interact with content</li>
              <li>Manage your profile</li>
            </ul>
            <p>Happy blogging!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Blog API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

        return await this.sendEmail({
          to: user.email,
          subject: "Welcome to Blog API!",
          html,
          text: `Welcome to Blog API! Your email has been verified successfully.`,
        });
    }
    async verifyConnection(){
        try {
            await this.transporter.verify();
            logger.info('Email service is ready');
            return true;
        } catch (error) {
            logger.error('Email service connection failed',error)
            return false;
        }
    }

}
const emailService = new EmailService()
export default emailService;