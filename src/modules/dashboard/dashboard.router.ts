import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import * as controller from './dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/company', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.getCompanyStats);
router.get('/project/:id', controller.getProjectStats);
router.get('/my-tasks', controller.getMyTasks);
router.get('/activity-feed', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), controller.getActivityFeed);

export default router;
