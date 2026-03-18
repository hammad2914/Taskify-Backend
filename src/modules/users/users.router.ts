import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema, updateStatusSchema } from './users.schema';
import * as controller from './users.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.listUsers);
router.post('/', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), validate(createUserSchema), controller.createUser);
router.get('/:id', controller.getUserById);
router.patch('/:id', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), validate(updateUserSchema), controller.updateUser);
router.patch('/:id/status', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), validate(updateStatusSchema), controller.updateUserStatus);
router.delete('/:id', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.deleteUser);

export default router;
