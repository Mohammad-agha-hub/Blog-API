import express from 'express';
import ApiResponse from "../utils/response.js";
import Comment from "../model/Comment.js";
import { asyncHandler } from '../utils/asyncHandler.js';
import {authenticate} from '../middleware/auth.js'
const router = express.Router()
// PUT /api/comments/:id - Update comment (author only)
router.put('/:id',authenticate, asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return ApiResponse.error(res, "content is required", 400);
    }
    // Get existing comment
    const existing = await Comment.findExisting(id);
    // Check ownership
    if (existing.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    const comment = await Comment.updateComment(id, content);

    if (!comment) {
      return ApiResponse.error(res, "Comment not found", 404);
    }

    ApiResponse.success(res, { comment }, "Comment updated successfully");
  } catch (error) {
    next(error);
  }
}));

// DELETE /api/comments/:id - Delete comment (author, post author, or admin)
router.delete('/:id',authenticate, asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await Comment.getCommentWithPostInfo(id);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }
    // Can delete if: comment author, post author, or admin
    const canDelete =
      comment.user_id === req.user.id ||
      comment.post_author_id === req.user.id ||
      req.user.role === "admin";

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this comment",
      });
    }

    await Comment.deleteComment(id);

    ApiResponse.noContent(res);
  } catch (error) {
    next(error);
  }
}));

export default router;
