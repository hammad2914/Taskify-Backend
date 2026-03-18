import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import { registerSchema, loginSchema, acceptInviteSchema } from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/accept-invite', validate(acceptInviteSchema), controller.acceptInvite);
router.post('/resend-invite/:id', authenticate, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.resendInvite);

export default router;
