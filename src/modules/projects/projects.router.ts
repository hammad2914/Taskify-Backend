import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requireProjectMember, requireProjectAdmin } from '../../middleware/requireProjectMember';
import { createProjectSchema, updateProjectSchema, inviteMemberSchema } from './projects.schema';
import * as controller from './projects.controller';

const router = Router();

router.use(authenticate);

router.get('/', controller.listProjects);
router.post('/', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), validate(createProjectSchema), controller.createProject);
router.get('/:id', requireProjectMember, controller.getProjectById);
router.patch('/:id', requireProjectAdmin, validate(updateProjectSchema), controller.updateProject);
router.delete('/:id', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.archiveProject);
router.post('/:id/invite', requireProjectAdmin, validate(inviteMemberSchema), controller.inviteMember);
router.post('/:id/accept', authenticate, controller.acceptInvitation);
router.delete('/:id/members/:uid', requireProjectAdmin, controller.removeMember);

export default router;
