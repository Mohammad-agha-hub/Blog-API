import { body,param,query, validationResult } from "express-validator";

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors
        .array()
        .map((err) => ({ field: err.path, message: err.msg })),
    });
  }
  next();
};

// Username validation
const usernameValidation = body('username')
  .trim()
  .isLength({ min: 3, max: 50 })
  .withMessage('Username must be between 3 and 50 characters')
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
  .custom((value) => {
    const forbiddenUsernames = ['admin', 'root', 'system', 'api', 'null', 'undefined'];
    if (forbiddenUsernames.includes(value.toLowerCase())) {
      throw new Error('This username is not allowed');
    }
    return true;
  });

// Email validation
const emailValidation = body('email')
  .trim()
  .isEmail()
  .withMessage('Must be a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email is too long')
  .custom((value) => {
    // Block disposable email domains
    const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const domain = value.split('@')[1];
    if (disposableDomains.includes(domain)) {
      throw new Error('Disposable email addresses are not allowed');
    }
    return true;
  });
// Strong password validation
const passwordValidation = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  .custom((value) => {
    const commonPasswords = ['password123', 'Password123!', 'Admin123!'];
    if (commonPasswords.includes(value)) {
      throw new Error('This password is too common');
    }
    return true;
  });

// Registration validation rules
const registerValidation = [
  usernameValidation,
  emailValidation,
  passwordValidation,
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),

  validate,
];



// Login validation rules
const loginValidation = [
  emailValidation,

  body("password").notEmpty().withMessage("Password is required"),

  validate,
];

// Password change validation
const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  passwordValidation,

  body("confirmNewPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match"),

  validate,
];



const validatePost = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage("Title must be between 5 and 255 characters")
    .escape(),
  body("content")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters"),
  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Excerpt cannot exceed 500 characters"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Invalid status"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((value) => value.length <= 10)
    .withMessage("Maximum 10 tags allowed"),
  validate
];

// Comment validation
const commentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters')
    .escape(),
  
  body('parent_id')
    .optional()
    .isInt()
    .withMessage('Invalid parent comment ID'),
  
  validate
];

// ID parameter validation
const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ID'),
  validate
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  validate
];

export {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  validatePost,
  commentValidation,
  idValidation,
  paginationValidation,
  validate,
};