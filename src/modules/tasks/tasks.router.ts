import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requireTaskMember, requireTaskAdmin } from '../../middleware/requireProjectMember';
import { createTaskSchema, updateTaskSchema, addCommentSchema, requestRevisionSchema, updateStatusSchema } from './tasks.schema';
import * as controller from './tasks.controller';

const router = Router();

router.use(authenticate);

// Task routes under /tasks/:id  (req.params.id = taskId)
router.get('/:id', requireTaskMember, controller.getTaskById);
router.patch('/:id', requireTaskAdmin, validate(updateTaskSchema), controller.updateTask);
router.patch('/:id/status', requireTaskMember, validate(updateStatusSchema), controller.updateTaskStatus);
router.post('/:id/accept-timeline', requireTaskMember, controller.acceptTimeline);
router.post('/:id/request-revision', requireTaskMember, validate(requestRevisionSchema), controller.requestRevision);
router.post('/:id/comments', requireTaskMember, validate(addCommentSchema), controller.addComment);
router.get('/:id/comments', requireTaskMember, controller.listComments);

export default router;
