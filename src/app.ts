import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import hrRouter from './modules/hr/hr.router';
import projectsRouter from './modules/projects/projects.router';
import tasksRouter from './modules/tasks/tasks.router';
import notificationsRouter from './modules/notifications/notifications.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import reportsRouter from './modules/reports/reports.router';
import demoRouter from './modules/demo/demo.router';
import { authenticate } from './middleware/auth';
import { requireProjectMember } from './middleware/requireProjectMember';
import { createTaskSchema } from './modules/tasks/tasks.schema';
import { validate } from './middleware/validate';
import * as tasksController from './modules/tasks/tasks.controller';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
});

app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/demo', demoRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/hr', hrRouter);
app.use('/api/projects', projectsRouter);

// Project-nested task creation
app.post(
  '/api/projects/:id/tasks',
  authenticate,
  requireProjectMember,
  validate(createTaskSchema),
  tasksController.createTask,
);
// Project-nested task list
app.get(
  '/api/projects/:id/tasks',
  authenticate,
  requireProjectMember,
  tasksController.listProjectTasks,
);

app.use('/api/tasks', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
