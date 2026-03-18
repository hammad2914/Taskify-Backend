import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { testConnectionSchema } from './hr.schema';
import * as controller from './hr.controller';

const router = Router();

router.use(authenticate, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']));

router.post('/test-connection', validate(testConnectionSchema), controller.testConnection);
router.post('/sync', controller.syncEmployees);
router.get('/status', controller.getStatus);

export default router;
