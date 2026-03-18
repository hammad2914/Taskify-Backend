import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { generateReportSchema } from './reports.schema';
import * as controller from './reports.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'MEMBER']));

router.post('/generate', validate(generateReportSchema), controller.generateReport);
router.get('/', controller.listReports);
router.get('/:id/download', controller.downloadReport);

export default router;
