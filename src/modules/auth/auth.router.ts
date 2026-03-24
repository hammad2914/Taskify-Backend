import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate, requireRole } from '../../middleware/auth';
import { registerSchema, loginSchema, acceptInviteSchema, changePasswordSchema, updateCompanyNameSchema } from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);
router.get('/invite/:token', controller.getInviteDetails);
router.post('/accept-invite', validate(acceptInviteSchema), controller.acceptInvite);
router.post('/resend-invite/:id', authenticate, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.resendInvite);
router.post('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);
router.patch('/company', authenticate, requireRole(['COMPANY_ADMIN']), validate(updateCompanyNameSchema), controller.updateCompanyName);

export default router;
