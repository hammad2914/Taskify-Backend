import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';

const DEMO_ADMIN_EMAIL = 'demo@taskify.app';
const DEMO_ADMIN_PASSWORD = 'Demo@123456';
const DEMO_COMPANY_NAME = 'Demo Company';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
function monthsFromNow(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
}

export async function resetDemo(): Promise<{ email: string; password: string }> {
  // Explicit deletion order to avoid FK constraint violations.
  // PostgreSQL cascade order is non-deterministic; we must delete leaf-to-root manually.
  const existing = await prisma.company.findFirst({ where: { name: DEMO_COMPANY_NAME }, select: { id: true } });
  if (existing) {
    const companyId = existing.id;

    const projectIds = await prisma.project
      .findMany({ where: { companyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const userIds = await prisma.user
      .findMany({ where: { companyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    // Leaves first, then parents
    await prisma.activityLog.deleteMany({ where: { companyId } });
    await prisma.report.deleteMany({ where: { companyId } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.invitationToken.deleteMany({ where: { userId: { in: userIds } } });
    if (projectIds.length > 0) {
      await prisma.taskComment.deleteMany({ where: { task: { projectId: { in: projectIds } } } });
      await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
    }
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  }

  // ── Company ──────────────────────────────────────────────────────
  const company = await prisma.company.create({
    data: { name: DEMO_COMPANY_NAME },
  });

  // ── Users ─────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const memberHash = await bcrypt.hash('Member@123', 12);

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'Demo Admin',
      email: DEMO_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
      designation: 'Product Manager',
      department: 'Management',
    },
  });

  const [alice, bob, carol, david] = await Promise.all([
    prisma.user.create({ data: { companyId: company.id, fullName: 'Alice Chen', email: 'alice@demo.taskify.app', passwordHash: memberHash, role: 'MEMBER', status: 'ACTIVE', department: 'Engineering', designation: 'Senior Engineer' } }),
    prisma.user.create({ data: { companyId: company.id, fullName: 'Bob Martinez', email: 'bob@demo.taskify.app', passwordHash: memberHash, role: 'MEMBER', status: 'ACTIVE', department: 'Design', designation: 'UI/UX Designer' } }),
    prisma.user.create({ data: { companyId: company.id, fullName: 'Carol Smith', email: 'carol@demo.taskify.app', passwordHash: memberHash, role: 'MEMBER', status: 'ACTIVE', department: 'Engineering', designation: 'Backend Engineer' } }),
    prisma.user.create({ data: { companyId: company.id, fullName: 'David Kim', email: 'david@demo.taskify.app', passwordHash: memberHash, role: 'MEMBER', status: 'ACTIVE', department: 'QA', designation: 'QA Engineer' } }),
  ]);

  // ── Projects ──────────────────────────────────────────────────────
  const [ecomProject, mobileProject, dashProject] = await Promise.all([
    prisma.project.create({ data: { companyId: company.id, name: 'E-Commerce Platform', description: 'Full-stack e-commerce solution with payments, inventory, and analytics.', status: 'ACTIVE', startDate: monthsAgo(3), endDate: monthsFromNow(1), createdById: admin.id } }),
    prisma.project.create({ data: { companyId: company.id, name: 'Mobile App v2', description: 'React Native redesign with new onboarding flow and offline support.', status: 'ACTIVE', startDate: monthsAgo(2), endDate: monthsFromNow(2), createdById: admin.id } }),
    prisma.project.create({ data: { companyId: company.id, name: 'Internal Dashboard', description: 'Internal analytics dashboard for business intelligence reporting.', status: 'COMPLETED', startDate: monthsAgo(6), endDate: monthsAgo(1), createdById: admin.id } }),
  ]);

  // Project memberships
  await prisma.projectMember.createMany({
    data: [
      { projectId: ecomProject.id, userId: admin.id,  role: 'PROJECT_ADMIN', status: 'ACCEPTED' },
      { projectId: ecomProject.id, userId: alice.id,  role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: ecomProject.id, userId: carol.id,  role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: ecomProject.id, userId: david.id,  role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: mobileProject.id, userId: admin.id, role: 'PROJECT_ADMIN', status: 'ACCEPTED' },
      { projectId: mobileProject.id, userId: bob.id,  role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: mobileProject.id, userId: alice.id, role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: dashProject.id, userId: admin.id,  role: 'PROJECT_ADMIN', status: 'ACCEPTED' },
      { projectId: dashProject.id, userId: carol.id,  role: 'MEMBER', status: 'ACCEPTED' },
      { projectId: dashProject.id, userId: david.id,  role: 'MEMBER', status: 'ACCEPTED' },
    ],
  });

  // ── Tasks (19) ────────────────────────────────────────────────────
  // Admin gets 4 tasks so "My Tasks" is populated when logging in as demo admin
  const taskDefs = [
    // Admin tasks — visible on My Tasks page after demo login
    { projectId: ecomProject.id,  title: 'Sprint planning & backlog grooming', assigneeId: admin.id, priority: 'HIGH' as const,     status: 'IN_PROGRESS' as const, startDate: daysAgo(3),     deadline: daysFromNow(2),  timelineAccepted: true  },
    { projectId: mobileProject.id, title: 'Stakeholder progress report',        assigneeId: admin.id, priority: 'MEDIUM' as const,   status: 'PENDING' as const,     startDate: daysAgo(1),     deadline: daysFromNow(5),  timelineAccepted: false },
    { projectId: dashProject.id,  title: 'Q1 budget review & sign-off',         assigneeId: admin.id, priority: 'CRITICAL' as const, status: 'OVERDUE' as const,     startDate: daysAgo(14),    deadline: daysAgo(2),      timelineAccepted: true  },
    { projectId: ecomProject.id,  title: 'Security audit checklist',            assigneeId: admin.id, priority: 'HIGH' as const,     status: 'COMPLETED' as const,   startDate: monthsAgo(1),   deadline: daysAgo(6),      timelineAccepted: true,  completedAt: daysAgo(6) },
    // E-Commerce (6 tasks) — completedAt within last 14 days so trend chart shows data
    { projectId: ecomProject.id, title: 'Payment gateway integration', assigneeId: alice.id, priority: 'HIGH' as const,   status: 'COMPLETED' as const,   startDate: monthsAgo(3),    deadline: daysAgo(12),     timelineAccepted: true,  completedAt: daysAgo(11) },
    { projectId: ecomProject.id, title: 'Product catalog API',          assigneeId: carol.id, priority: 'HIGH' as const,  status: 'COMPLETED' as const,   startDate: monthsAgo(2),    deadline: daysAgo(7),      timelineAccepted: true,  completedAt: daysAgo(7)  },
    { projectId: ecomProject.id, title: 'Shopping cart UI',             assigneeId: bob.id,   priority: 'MEDIUM' as const, status: 'IN_PROGRESS' as const, startDate: daysAgo(20),    deadline: daysFromNow(10), timelineAccepted: true },
    { projectId: ecomProject.id, title: 'Order tracking module',        assigneeId: alice.id, priority: 'MEDIUM' as const, status: 'ACCEPTED' as const,    startDate: daysAgo(5),     deadline: daysFromNow(20), timelineAccepted: true },
    { projectId: ecomProject.id, title: 'Performance optimisation',     assigneeId: carol.id, priority: 'LOW' as const,    status: 'PENDING' as const,     startDate: daysFromNow(5), deadline: daysFromNow(30), timelineAccepted: false },
    { projectId: ecomProject.id, title: 'Mobile checkout flow',         assigneeId: david.id, priority: 'CRITICAL' as const, status: 'OVERDUE' as const,   startDate: daysAgo(30),    deadline: daysAgo(5),      timelineAccepted: true },
    // Mobile App v2 (5 tasks)
    { projectId: mobileProject.id, title: 'Onboarding screens redesign', assigneeId: bob.id,   priority: 'HIGH' as const,     status: 'COMPLETED' as const,   startDate: monthsAgo(2),    deadline: daysAgo(5),      timelineAccepted: true, completedAt: daysAgo(4)  },
    { projectId: mobileProject.id, title: 'Offline sync engine',          assigneeId: alice.id, priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, startDate: daysAgo(15),    deadline: daysFromNow(15), timelineAccepted: true },
    { projectId: mobileProject.id, title: 'Push notification service',    assigneeId: carol.id, priority: 'MEDIUM' as const,   status: 'IN_PROGRESS' as const, startDate: daysAgo(10),    deadline: daysFromNow(20), timelineAccepted: true },
    { projectId: mobileProject.id, title: 'App store submission',         assigneeId: david.id, priority: 'HIGH' as const,     status: 'PENDING' as const,     startDate: daysFromNow(10), deadline: daysFromNow(40), timelineAccepted: false },
    { projectId: mobileProject.id, title: 'Beta testing sign-off',        assigneeId: david.id, priority: 'HIGH' as const,     status: 'OVERDUE' as const,     startDate: daysAgo(20),    deadline: daysAgo(3),      timelineAccepted: true },
    // Internal Dashboard (4 tasks)
    { projectId: dashProject.id, title: 'Data warehouse schema',    assigneeId: carol.id, priority: 'HIGH' as const,   status: 'COMPLETED' as const,   startDate: monthsAgo(6), deadline: daysAgo(9),      timelineAccepted: true, completedAt: daysAgo(9)  },
    { projectId: dashProject.id, title: 'KPI visualisation charts', assigneeId: bob.id,   priority: 'MEDIUM' as const, status: 'COMPLETED' as const,   startDate: monthsAgo(4), deadline: daysAgo(2),      timelineAccepted: true, completedAt: daysAgo(2)  },
    { projectId: dashProject.id, title: 'User permission matrix',   assigneeId: alice.id, priority: 'MEDIUM' as const, status: 'ACCEPTED' as const,    startDate: monthsAgo(2), deadline: daysFromNow(4),  timelineAccepted: true },
    { projectId: dashProject.id, title: 'Export to CSV/PDF',        assigneeId: david.id, priority: 'LOW' as const,    status: 'IN_PROGRESS' as const, startDate: monthsAgo(1), deadline: daysFromNow(5),  timelineAccepted: true },
  ];

  const tasks = await Promise.all(
    taskDefs.map((t) =>
      prisma.task.create({
        data: {
          companyId: company.id,
          projectId: t.projectId,
          title: t.title,
          assigneeId: t.assigneeId,
          createdById: admin.id,
          priority: t.priority,
          status: t.status,
          startDate: t.startDate,
          deadline: t.deadline,
          timelineAccepted: t.timelineAccepted,
          completedAt: t.completedAt ?? null,
        },
      }),
    ),
  );

  // ── Activity Logs (20) ────────────────────────────────────────────
  const allUsers = [admin, alice, bob, carol, david];
  const allProjects = [ecomProject, mobileProject, dashProject];
  const activityActions = [
    { action: 'CREATE', entity: 'TASK' },
    { action: 'UPDATE', entity: 'TASK' },
    { action: 'STATUS_CHANGE', entity: 'TASK' },
    { action: 'CREATE', entity: 'PROJECT' },
    { action: 'ACCEPT_TIMELINE', entity: 'TASK' },
  ];

  for (let i = 0; i < 20; i++) {
    const user = allUsers[i % allUsers.length];
    const project = allProjects[i % allProjects.length];
    const act = activityActions[i % activityActions.length];
    const task = tasks[i % tasks.length];
    await prisma.activityLog.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        userId: user.id,
        action: act.action,
        entity: act.entity,
        entityId: task.id,
        createdAt: daysAgo(Math.floor((30 / 20) * i)),
      },
    });
  }

  // ── Notifications (10) ────────────────────────────────────────────
  const notifDefs = [
    { type: 'TASK_ASSIGNED' as const,           title: 'New task assigned',            body: 'You have been assigned "Shopping cart UI"',           isRead: false },
    { type: 'TASK_STATUS_CHANGED' as const,     title: 'Task completed',               body: 'Payment gateway integration has been marked complete', isRead: true  },
    { type: 'PROJECT_INVITATION' as const,      title: 'Invited to E-Commerce Platform', body: 'Admin invited you to join E-Commerce Platform',     isRead: true  },
    { type: 'COMMENT_ADDED' as const,           title: 'New comment',                  body: 'Alice commented on Offline sync engine',              isRead: false },
    { type: 'TASK_ASSIGNED' as const,           title: 'New task assigned',            body: 'You have been assigned "Order tracking module"',      isRead: false },
    { type: 'TIMELINE_REVISION_REQUESTED' as const, title: 'Revision requested',       body: 'Bob requested a timeline revision for Cart UI',       isRead: true  },
    { type: 'TASK_STATUS_CHANGED' as const,     title: 'Task overdue',                 body: 'Mobile checkout flow is now overdue',                  isRead: false },
    { type: 'GENERAL' as const,                 title: 'Welcome to Demo Company',      body: 'Your demo workspace has been set up successfully',    isRead: true  },
    { type: 'COMMENT_ADDED' as const,           title: 'New comment',                  body: 'Carol left a comment on Data warehouse schema',       isRead: false },
    { type: 'TASK_ASSIGNED' as const,           title: 'New task assigned',            body: 'You have been assigned "App store submission"',       isRead: true  },
  ];

  await prisma.notification.createMany({
    data: notifDefs.map((n, i) => ({
      userId: admin.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: daysAgo(i * 2),
    })),
  });

  // ── Reports (2) ───────────────────────────────────────────────────
  const mockReportData = {
    summary: 'Project is progressing well with 60% of tasks completed on schedule.',
    performanceScore: 78,
    keyMetrics: [
      { label: 'Tasks Completed', value: '9 / 15' },
      { label: 'On-Time Delivery', value: '87%' },
      { label: 'Team Velocity', value: '4.2 tasks/week' },
      { label: 'Overdue Tasks', value: '2' },
    ],
    risks: [
      { level: 'HIGH' as const,   description: 'Two tasks are overdue and blocking downstream dependencies.' },
      { level: 'MEDIUM' as const, description: 'Mobile checkout flow has no assigned reviewer.' },
      { level: 'LOW' as const,    description: 'Documentation has not been updated this sprint.' },
    ],
    recommendations: [
      'Prioritise resolving the overdue tasks before starting new work.',
      'Schedule a team sync to unblock the mobile checkout flow.',
      'Consider breaking large tasks into smaller, time-boxed units.',
    ],
  };

  await Promise.all([
    prisma.report.create({
      data: {
        companyId: company.id,
        projectId: ecomProject.id,
        createdById: admin.id,
        type: 'PROJECT_SUMMARY',
        title: 'E-Commerce Platform — Project Summary',
        data: mockReportData,
        aiGenerated: true,
        createdAt: daysAgo(7),
      },
    }),
    prisma.report.create({
      data: {
        companyId: company.id,
        projectId: mobileProject.id,
        createdById: admin.id,
        type: 'RISK_DETECTION',
        title: 'Mobile App v2 — Risk Detection Report',
        data: { ...mockReportData, performanceScore: 65 },
        aiGenerated: true,
        createdAt: daysAgo(3),
      },
    }),
  ]);

  return { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD };
}

export async function loginDemoAdmin(): Promise<{
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
  company: Record<string, unknown>;
}> {
  const { email, password } = await resetDemo();

  const user = await prisma.user.findFirst({
    where: { email },
    include: { company: true },
  });

  if (!user || !user.passwordHash) {
    throw { status: 500, message: 'Demo reset failed', code: 'DEMO_ERROR' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw { status: 500, message: 'Demo credentials invalid', code: 'DEMO_ERROR' };

  const accessToken  = generateAccessToken({ userId: user.id, companyId: user.companyId, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id, companyId: user.companyId, role: user.role });

  const safeUser = {
    id: user.id, companyId: user.companyId, fullName: user.fullName,
    email: user.email, role: user.role, status: user.status,
    department: user.department, designation: user.designation, avatarUrl: user.avatarUrl,
  };

  return { accessToken, refreshToken, user: safeUser, company: user.company };
}
