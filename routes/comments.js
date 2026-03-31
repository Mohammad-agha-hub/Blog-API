import express from 'express';
import ApiResponse from "../utils/response.js";
import Comment from "../model/Comment.js";

const router = express.Router()

// PUT /api/comments/:id - Update comment
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return ApiResponse.error(res, 'content is required', 400);
    }
    
    const comment = await Comment.updateComment(id, content);
    
    if (!comment) {
      return ApiResponse.error(res, 'Comment not found', 404);
    }
    
    ApiResponse.success(res, { comment }, 'Comment updated successfully');
  } catch (error) {
    next(error);
  }
});

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const comment = await Comment.deleteComment(id);
    
    if (!comment) {
      return ApiResponse.error(res, 'Comment not found', 404);
    }
    
    ApiResponse.noContent(res);
  } catch (error) {
    next(error);
  }
});

export default router;
