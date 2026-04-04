import express from 'express';

const router = express.Router()
import Post from '../model/Post.js'
import Comment from '../model/Comment.js'
import Pagination from '../utils/pagination.js'
import ApiResponse from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/posts - List posts with filters and pagination
router.get('/',asyncHandler(async(req,res,next)=>{
    try {
        const {page = 1,limit = 10,status,userId,search,tag} = req.query;
        const {limit:pLimit,offset,page:pPage} = Pagination.paginate(page,limit);
        const filters = {
            limit:pLimit,
            offset,
            status,
            userId,
            search,
            tag
        }
        const {posts,total} = await Post.findAll(filters)
        const response = Pagination.buildResponse(posts,total,pPage,pLimit)
        ApiResponse.success(res,response)
    } catch (error) {
        next(error)
    }
}))

// GET /api/posts/:slug - Get single post
router.get('/:slug',asyncHandler(async(req,res,next)=>{
    try {
        const { slug } = req.params;
        const { includeComments } = req.query;
        let post;
        if (includeComments) {
          post = await Post.findWithComments(slug);
        } else {
          post = await Post.findBySlug(slug);
        }
        if (!post) {
          return ApiResponse.error(res, "Post not found", 404);
        }
        
        // Increment view count
        await Post.incrementViews(slug);
        ApiResponse.success(res,{post})
    } catch (error) {
        next(error)    
    }
}))

// POST /api/posts - Create post
router.post('/', asyncHandler(async (req, res, next) => {
  try {
    const { title, content, excerpt, featured_image, status, tags } = req.body;
    
    // Validation
    if (!title || !content) {
      return ApiResponse.error(res, 'title and content are required', 400);
    }
    
    // In real app, get user_id from auth token
    const user_id = req.body.user_id;
    
    if(!user_id){
        return ApiResponse.error(
          res,
          "User id is required!",
          400,
        );
    }

    const post = await Post.createPost(
      { user_id, title, content, excerpt, featured_image, status },
      tags || []
    );
    
    ApiResponse.created(res, { post }, 'Post created successfully');
  } catch (error) {
    if (error.code === '23505') {
      return ApiResponse.error(res, 'A post with similar title already exists', 409);
    }
    next(error);
  }
}));

// PUT /api/posts/:slug - Update post
router.put('/:slug', asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { title, content, excerpt, featured_image, status, tags } = req.body;
    
    const post = await Post.updatePost(
      slug,
      { title, content, excerpt, featured_image, status },
      tags
    );
    
    ApiResponse.success(res, { post }, 'Post updated successfully');
  } catch (error) {
    if (error.message === 'Post not found') {
      return ApiResponse.error(res, 'Post not found', 404);
    }
    next(error);
  }
}));

// DELETE /api/posts/:slug - Delete post
router.delete('/:slug', asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const post = await Post.deletePost(slug);
    
    if (!post) {
      return ApiResponse.error(res, 'Post not found', 404);
    }
    
    ApiResponse.noContent(res);
  } catch (error) {
    next(error);
  }
}));

// POST /api/posts/:slug/like - Like post
router.post('/:slug/like', asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const result = await Post.toggleLike(slug, true);
    
    if (!result) {
      return ApiResponse.error(res, 'Post not found', 404);
    }
    
    ApiResponse.success(res, { likeCount: result.like_count });
  } catch (error) {
    next(error);
  }
}));

// POST /api/posts/:slug/comments - Add comment to post

router.post('/:slug/comments',asyncHandler(async(req,res,next)=>{
    try {
      const {slug} = req.params;
      const {content,parent_id} = req.body;
       if (!content) {
         return ApiResponse.error(res, "content is required", 400);
       }

       // Get post by slug
       const post = await Post.findBySlug(slug);

       if (!post) {
         return ApiResponse.error(res, "Post not found", 404);
       }

       const user_id = req.body.user_id; 
       if (!user_id) {
         return ApiResponse.error(res, "User id is required!", 400);
       }
       const comment = await Comment.createComment({
         post_id: post.id,
         user_id,
         content,
         parent_id: parent_id || null,
       });

       ApiResponse.created(res, { comment }, "Comment added successfully");
    } catch (error) {
        next(error)
    }
}))

export default router;
