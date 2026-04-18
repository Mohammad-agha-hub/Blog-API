import express from 'express';

const router = express.Router()
import Post from '../model/Post.js'
import Comment from '../model/Comment.js'
import Pagination from '../utils/pagination.js'
import ApiResponse from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js';
import {authenticate,authorize,optionalAuth,requireVerified} from '../middleware/auth.js'
import {validatePost} from '../middleware/validation.js'

// GET /api/posts - List posts with filters and pagination
router.get('/',optionalAuth,asyncHandler(async(req,res,next)=>{
    try {
        const {page = 1,limit = 10,status,userId,search,tag} = req.query;
        const {limit:pLimit,offset,page:pPage} = Pagination.paginate(page,limit);
        const filters = {
            limit:pLimit,
            offset,
            userId,
            search,
            tag
        }
        if(!req.user || req.user.role !=='admin'){
          filters.status = 'published'
        }
        else if(status){
          filters.status = status;
        }

        const {posts,total} = await Post.findAll(filters)
        const response = Pagination.buildResponse(posts,total,pPage,pLimit)
        ApiResponse.success(res,response)
    } catch (error) {
        next(error)
    }
}))

// GET /api/posts/my - Get current user's posts
router.get('/my',authenticate,async(req,res,next)=>{
  try {
    const posts = await Post.findAll({userId:req.user.id})
     res.json({
       success: true,
       data: { posts, count: posts.length },
     });
  } catch (error) {
    next(error)
  }
})

// GET /api/posts/:slug - Get single post
router.get('/:slug',optionalAuth,asyncHandler(async(req,res,next)=>{
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
        // Check if user can view this post
        if(post.status !== 'published'){
          // Only author and admins can view unpublished posts
          if(!req.user || (req.user.id !==post.user_id && req.user.role !=='admin')){
            return res.status(403).json({
              success: false,
              message: "Access denied",
            });
          }
        }
        // Increment view count
        await Post.incrementViews(slug);
        ApiResponse.success(res,{post})
    } catch (error) {
        next(error)    
    }
}))

// POST /api/posts - Create post (authenticated users with author or admin role)
router.post('/',authenticate,requireVerified,authorize('author','admin'),validatePost,asyncHandler(async (req, res, next) => {
  try {
    const { title, content, excerpt, featured_image, status, tags } = req.body;
    
    // Validation
    if (!title || !content) {
      return ApiResponse.error(res, 'title and content are required', 400);
    }
    
    
    const user_id = req.user.id;
    
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
router.put('/:slug',authenticate,validatePost, asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { title, content, excerpt, featured_image, status, tags } = req.body;
    // Get existing post
    const existingPost = await Post.findBySlug(slug);
    if(!existingPost){
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
    // Check ownership (author or admin)
    if(existingPost.user_id !== req.user.id && req.user.role !=='admin'){
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this post",
      });
    }

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

// DELETE /api/posts/:slug - Delete post (author or admin)
router.delete('/:slug',authenticate, asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    // Get existing post
    const existingPost = await Post.findBySlug(slug);

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
    // Check ownership
    if(req.user.id !== existingPost.user_id && req.user.role !== 'admin'){
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this post",
      });
    }
     await Post.deletePost(slug);
    
    ApiResponse.noContent(res);
  } catch (error) {
    next(error);
  }
}));

// POST /api/posts/:slug/like - Like post
router.post('/:slug/like',authenticate, asyncHandler(async (req, res, next) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id
    const post = await Post.findBySlug(slug);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
    const result = await Post.toggleLike(slug, userId);
    
    if (!result) {
      return ApiResponse.error(res, 'Post not found', 404);
    }
    
    ApiResponse.success(res, { likeCount: result.like_count,liked:result.liked });
  } catch (error) {
    next(error);
  }
}));

// POST /api/posts/:slug/comments - Add comment to post

router.post('/:slug/comments',authenticate,asyncHandler(async(req,res,next)=>{
    try {
      const {slug} = req.params;
      const {content,parent_id} = req.body;
      const user_id = req.user.id; 
       
      if (!content || content.trim().length < 1) {
         return ApiResponse.error(res, "content is required", 400);
       }

       // Get post by slug
       const post = await Post.findBySlug(slug);

       if (!post) {
         return ApiResponse.error(res, "Post not found", 404);
       }
       // Only allow comments on published posts (unless u are the author or admin)
       if(post.status !=='published' && post.user_id !== req.user.id && req.user.role !== 'admin'){
        return res.status(403).json({
          success:false,
          message:'Cannot comment on unpublished posts'
        })
       }
       
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
