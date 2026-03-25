import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './demo.controller';

const router = Router();

// Max 5 resets per hour per IP
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many demo requests — please try again in an hour' },
});

router.post('/reset', demoLimiter, controller.reset);
router.get('/login', demoLimiter, controller.demoLogin);

export default router;
