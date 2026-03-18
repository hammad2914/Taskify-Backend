import { prisma } from '../../config/database';

export async function getCompanyStats(companyId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalEmployees, activeProjects, completedTasks, overdueTasks] =
    await prisma.$transaction([
      prisma.user.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.project.count({ where: { companyId, status: 'ACTIVE' } }),
      prisma.task.count({ where: { companyId, status: 'COMPLETED' } }),
      prisma.task.count({ where: { companyId, status: 'OVERDUE' } }),
    ]);

  const tasksByStatusRaw = await prisma.task.groupBy({
    by: ['status'],
    where: { companyId },
    _count: true,
    orderBy: { _count: { status: 'desc' } },
  });

  const recentActivity = await prisma.activityLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { fullName: true, avatarUrl: true } }, project: { select: { name: true } } },
  });

  const dailyCompletions = await prisma.task.findMany({
    where: { companyId, status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo } },
    select: { completedAt: true },
  });

  const trendMap: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0]!;
    trendMap[key] = 0;
  }

  for (const task of dailyCompletions) {
    if (task.completedAt) {
      const key = task.completedAt.toISOString().split('T')[0]!;
      if (key in trendMap) trendMap[key] = (trendMap[key] ?? 0) + 1;
    }
  }

  const productivityTrend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    totalEmployees,
    activeProjects,
    completedTasks,
    overdueTasks,
    tasksByStatus: tasksByStatusRaw.map((s) => ({ status: s.status, count: s._count })),
    productivityTrend,
    recentActivity,
  };
}

export async function getProjectStats(projectId: string, companyId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: { _count: { select: { tasks: true, members: true } } },
  });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const [tasksByStatusRaw, tasksByPriorityRaw, memberWorkloadRaw] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId, companyId },
      _count: true,
      orderBy: { _count: { status: 'desc' } },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { projectId, companyId },
      _count: true,
      orderBy: { _count: { priority: 'desc' } },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { projectId, companyId, status: 'IN_PROGRESS' },
      _count: true,
      orderBy: { _count: { assigneeId: 'desc' } },
    }),
  ]);

  const totalTasks = project._count.tasks;
  const completedCount = tasksByStatusRaw.find((s) => s.status === 'COMPLETED')?._count ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const now = new Date();
  const timelineProgress = project.startDate && project.endDate
    ? Math.min(100, Math.max(0, Math.round(
        ((now.getTime() - project.startDate.getTime()) /
          (project.endDate.getTime() - project.startDate.getTime())) * 100
      )))
    : 0;

  return {
    project,
    totalTasks,
    completionRate,
    timelineProgress,
    tasksByStatus: tasksByStatusRaw.map((s) => ({ status: s.status, count: s._count })),
    tasksByPriority: tasksByPriorityRaw.map((p) => ({ priority: p.priority, count: p._count })),
    memberWorkload: memberWorkloadRaw,
  };
}

export async function getMyTasks(userId: string, companyId: string) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: userId, companyId },
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ deadline: 'asc' }],
  });

  const byStatus: Record<string, typeof tasks> = {
    PENDING: tasks.filter((t) => t.status === 'PENDING'),
    ACCEPTED: tasks.filter((t) => t.status === 'ACCEPTED'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    COMPLETED: tasks.filter((t) => t.status === 'COMPLETED'),
    OVERDUE: tasks.filter((t) => t.status === 'OVERDUE'),
  };

  return { tasks, byStatus };
}

export async function getActivityFeed(companyId: string, limit = 50) {
  return prisma.activityLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { fullName: true, avatarUrl: true } },
      project: { select: { name: true } },
    },
  });
}
