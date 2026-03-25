import { prisma } from '../../config/database';
import { getSocketInstance } from '../../socket';
import { sendTaskAssignmentEmail } from '../../config/mailer';
import { env } from '../../config/env';
import type { CreateTaskInput, UpdateTaskInput, AddCommentInput } from './tasks.schema';

const taskSelect = {
  id: true,
  projectId: true,
  companyId: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  startDate: true,
  deadline: true,
  timelineAccepted: true,
  attachments: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  creator: { select: { id: true, fullName: true, avatarUrl: true } },
};

export async function listProjectTasks(projectId: string, companyId: string) {
  return prisma.task.findMany({
    where: { projectId, companyId },
    select: taskSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTaskById(id: string, companyId: string) {
  const task = await prisma.task.findFirst({
    where: { id, companyId },
    select: { ...taskSelect, comments: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } } },
  });
  if (!task) throw { status: 404, message: 'Task not found', code: 'NOT_FOUND' };
  return task;
}

export async function createTask(projectId: string, companyId: string, input: CreateTaskInput, createdById: string) {
  const startDate = new Date(input.startDate);
  const deadline = new Date(input.deadline);

  if (deadline <= startDate) throw { status: 400, message: 'Deadline must be after start date', code: 'INVALID_DATES' };

  const assignee = await prisma.user.findFirst({
    where: { id: input.assigneeId, companyId },
  });
  if (!assignee) throw { status: 404, message: 'Assignee not found in this company', code: 'NOT_FOUND' };

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: input.assigneeId, status: 'ACCEPTED' },
  });
  if (!member) throw { status: 400, message: 'Assignee is not a project member', code: 'NOT_PROJECT_MEMBER' };

  const task = await prisma.task.create({
    data: {
      projectId,
      companyId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      createdById,
      priority: input.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      startDate,
      deadline,
      attachments: input.attachments ?? [],
    },
    select: taskSelect,
  });

  await prisma.notification.create({
    data: {
      userId: input.assigneeId,
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      body: `You have been assigned: "${input.title}"`,
      link: `/projects/${projectId}/tasks/${task.id}`,
    },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${input.assigneeId}`).emit('task:assigned', { taskId: task.id, title: task.title, projectId });
    io.to(`user:${input.assigneeId}`).emit('notification:new', { type: 'TASK_ASSIGNED' });
    io.to(`company:${companyId}`).emit('dashboard:refresh', { type: 'task_created' });
  }

  try {
    await sendTaskAssignmentEmail(
      assignee.email,
      assignee.fullName,
      input.title,
      projectId,
      deadline,
      `${env.FRONTEND_URL}/projects/${projectId}/tasks/${task.id}`,
    );
  } catch (e) {
    console.error('Failed to send task assignment email:', e);
  }

  await prisma.activityLog.create({
    data: { companyId, projectId, userId: createdById, action: 'CREATE', entity: 'Task', entityId: task.id, metadata: { title: task.title } },
  });

  return task;
}

export async function updateTask(id: string, companyId: string, input: UpdateTaskInput, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id, companyId },
    include: { assignee: { select: { id: true, fullName: true, email: true } } },
  });
  if (!task) throw { status: 404, message: 'Task not found', code: 'NOT_FOUND' };

  // Hard timeline lock — nobody can change dates once accepted, not even admins
  if (task.timelineAccepted && (input.startDate || input.deadline)) {
    throw {
      status: 403,
      message: 'Timeline is locked. Start date and deadline cannot be changed after the assignee has accepted.',
      code: 'TIMELINE_LOCKED',
    };
  }

  // Detect whether dates are actually changing so we can tailor the notification
  const newStartDate = input.startDate ? new Date(input.startDate) : undefined;
  const newDeadline  = input.deadline  ? new Date(input.deadline)  : undefined;
  const timelineChanged =
    (newStartDate && newStartDate.getTime() !== new Date(task.startDate).getTime()) ||
    (newDeadline  && newDeadline.getTime()  !== new Date(task.deadline).getTime());

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined,
      startDate: newStartDate,
      deadline:  newDeadline,
      attachments: input.attachments,
      // Reset acceptance so the assignee must re-accept the new timeline
      ...(timelineChanged ? { timelineAccepted: false, status: 'PENDING' } : {}),
    },
    select: taskSelect,
  });

  // Notify the assignee when the admin changed the timeline
  if (timelineChanged && task.assigneeId && task.assigneeId !== userId) {
    const deadlineStr = newDeadline
      ? new Date(newDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: 'GENERAL',
        title: 'Task Timeline Updated',
        body: `The timeline for "${updated.title}" was updated by an admin. New deadline: ${deadlineStr}. Please review and accept the new timeline.`,
        link: `/projects/${task.projectId}/tasks/${id}`,
      },
    });

    const io = getSocketInstance();
    if (io) {
      io.to(`user:${task.assigneeId}`).emit('task:timeline_updated', {
        taskId: id,
        title: updated.title,
        projectId: task.projectId,
        deadline: updated.deadline,
      });
      io.to(`user:${task.assigneeId}`).emit('notification:new', { type: 'GENERAL' });
    }
  }

  await prisma.activityLog.create({
    data: { companyId, projectId: task.projectId, userId, action: 'UPDATE', entity: 'Task', entityId: id, metadata: { timelineChanged } },
  });

  return updated;
}

export async function updateTaskStatus(id: string, companyId: string, status: 'IN_PROGRESS' | 'COMPLETED', userId: string) {
  const task = await prisma.task.findFirst({ where: { id, companyId, assigneeId: userId } });
  if (!task) throw { status: 404, message: 'Task not found or not assigned to you', code: 'NOT_FOUND' };

  const validTransitions: Record<string, string[]> = {
    ACCEPTED:    ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED'],
    // Overdue tasks can be resumed or marked done directly (completing after the deadline)
    OVERDUE:     ['IN_PROGRESS', 'COMPLETED'],
  };

  if (!validTransitions[task.status]?.includes(status)) {
    throw { status: 400, message: `Cannot transition from ${task.status} to ${status}`, code: 'INVALID_TRANSITION' };
  }

  const now = new Date();
  const completedLate = status === 'COMPLETED' && now > new Date(task.deadline);

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === 'COMPLETED' ? now : undefined,
    },
    select: taskSelect,
  });

  // Log whether the task was completed late so the activity feed shows it
  if (completedLate) {
    console.log(`[TASK] Task "${task.title}" completed LATE (deadline: ${task.deadline.toISOString()}, completedAt: ${now.toISOString()})`);
  }

  const io = getSocketInstance();
  if (io) {
    io.to(`project:${task.projectId}`).emit('task:status_changed', { taskId: id, status, projectId: task.projectId });
    io.to(`company:${companyId}`).emit('dashboard:refresh', { type: 'task_status_changed' });
  }

  await prisma.activityLog.create({
    data: { companyId, projectId: task.projectId, userId, action: 'STATUS_CHANGE', entity: 'Task', entityId: id, metadata: { status } },
  });

  return updated;
}

export async function acceptTimeline(id: string, companyId: string, userId: string) {
  const task = await prisma.task.findFirst({ where: { id, companyId, assigneeId: userId } });
  if (!task) throw { status: 404, message: 'Task not found or not assigned to you', code: 'NOT_FOUND' };
  if (task.status !== 'PENDING') throw { status: 400, message: 'Task must be in PENDING status to accept timeline', code: 'INVALID_STATUS' };

  const updated = await prisma.task.update({
    where: { id },
    data: { status: 'ACCEPTED', timelineAccepted: true },
    select: taskSelect,
  });

  await prisma.activityLog.create({
    data: { companyId, projectId: task.projectId, userId, action: 'ACCEPT_TIMELINE', entity: 'Task', entityId: id },
  });

  return updated;
}

export async function requestRevision(id: string, companyId: string, userId: string, comment: string) {
  const task = await prisma.task.findFirst({
    where: { id, companyId, assigneeId: userId },
    include: { creator: true },
  });
  if (!task) throw { status: 404, message: 'Task not found or not assigned to you', code: 'NOT_FOUND' };

  await prisma.taskComment.create({
    data: {
      taskId: id,
      userId,
      content: `[REVISION REQUEST] ${comment}`,
    },
  });

  await prisma.task.update({
    where: { id },
    data: { status: 'PENDING', timelineAccepted: false },
  });

  await prisma.notification.create({
    data: {
      userId: task.createdById,
      type: 'TIMELINE_REVISION_REQUESTED',
      title: 'Timeline Revision Requested',
      body: `A revision was requested for task "${task.title}"`,
      link: `/projects/${task.projectId}/tasks/${id}`,
    },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${task.createdById}`).emit('task:timeline_revision', { taskId: id, requestedById: userId });
    io.to(`user:${task.createdById}`).emit('notification:new', { type: 'TIMELINE_REVISION_REQUESTED' });
  }

  return { message: 'Revision requested' };
}

export async function addComment(taskId: string, companyId: string, userId: string, input: AddCommentInput) {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId } });
  if (!task) throw { status: 404, message: 'Task not found', code: 'NOT_FOUND' };

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      userId,
      content: input.content,
      files: input.files ?? [],
    },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`project:${task.projectId}`).emit('task:comment_added', { taskId, comment });
  }

  return comment;
}

export async function listComments(taskId: string, companyId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId } });
  if (!task) throw { status: 404, message: 'Task not found', code: 'NOT_FOUND' };

  return prisma.taskComment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function markOverdueTasks() {
  const now = new Date();
  const result = await prisma.task.updateMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      deadline: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });
  return result.count;
}
