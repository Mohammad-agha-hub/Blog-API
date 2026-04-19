import express from 'express'
import Tag from '../model/Tag.js'
import ApiResponse from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// GET /api/tags - Get all tags
router.get('/',asyncHandler(async(req,res,next)=>{
   try {
     const tags = await Tag.findAllTags();
     ApiResponse.success(res, { tags, count: tags.length });
   } catch (error) {
     next(error);
   } 
}))

// GET /api/tags/:slug - Get tag by slug
router.get("/:slug", asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    const tag = await Tag.findTagBySlug(slug);
    if (!tag) {
      return ApiResponse.error(res, "Tag not found", 404);
    }

    ApiResponse.success(res, { tag });
  } catch (error) {
    next(error);
  }
}));

// POST /api/tags - Create tag
router.post('/',authenticate,authorize('admin'), asyncHandler(async (req, res, next) => {
try {
const { name, description } = req.body;
if (!name) {
  return ApiResponse.error(res, 'name is required', 400);
}

const tag = await Tag.createTag({ name, description });
ApiResponse.created(res, { tag }, 'Tag created successfully');
} catch (error) {
if (error.code === '23505') {
return ApiResponse.error(res, 'Tag with this name already exists', 409);
}
next(error);
}
}));

// PUT /api/tags/:slug - Update tag
router.put('/:slug',authenticate,authorize('admin'),asyncHandler( async (req, res, next) => {
try {
const { slug } = req.params;
const { name, description } = req.body;
const tag = await Tag.updateTag(slug, { name, description });

if (!tag) {
  return ApiResponse.error(res, 'Tag not found', 404);
}

ApiResponse.success(res, { tag }, 'Tag updated successfully');
} catch (error) {
next(error);
}
}));

// DELETE /api/tags/:slug - Delete tag
router.delete('/:slug',authenticate,authorize('admin'),asyncHandler( async (req, res, next) => {
try {
const { slug } = req.params;
const tag = await Tag.deleteTag(slug);

if (!tag) {
  return ApiResponse.error(res, 'Tag not found', 404);
}

ApiResponse.noContent(res);
} catch (error) {
next(error);
}
}));

export default router;
