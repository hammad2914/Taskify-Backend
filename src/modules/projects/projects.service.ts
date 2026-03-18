import { prisma } from '../../config/database';
import { getSocketInstance } from '../../socket';
import type { CreateProjectInput, UpdateProjectInput, InviteMemberInput } from './projects.schema';

export async function listProjects(companyId: string, userId: string, role: string) {
  if (role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN') {
    return prisma.project.findMany({
      where: { companyId },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return prisma.project.findMany({
    where: {
      companyId,
      members: { some: { userId, status: 'ACCEPTED' } },
    },
    include: {
      members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProjectById(id: string, companyId: string) {
  const project = await prisma.project.findFirst({
    where: { id, companyId },
    include: {
      members: {
        include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, designation: true, department: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };
  return project;
}

export async function createProject(input: CreateProjectInput, companyId: string, userId: string) {
  const project = await prisma.project.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      createdById: userId,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId,
      role: 'PROJECT_ADMIN',
      status: 'ACCEPTED',
      joinedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId,
      projectId: project.id,
      userId,
      action: 'CREATE',
      entity: 'Project',
      entityId: project.id,
      metadata: { name: project.name },
    },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`company:${companyId}`).emit('dashboard:refresh', { type: 'project_created' });
  }

  return project;
}

export async function updateProject(id: string, companyId: string, input: UpdateProjectInput, userId: string) {
  const project = await prisma.project.findFirst({ where: { id, companyId } });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const updated = await prisma.project.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      status: input.status as 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    },
  });

  await prisma.activityLog.create({
    data: { companyId, projectId: id, userId, action: 'UPDATE', entity: 'Project', entityId: id },
  });

  return updated;
}

export async function archiveProject(id: string, companyId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id, companyId } });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const archived = await prisma.project.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });

  await prisma.activityLog.create({
    data: { companyId, projectId: id, userId, action: 'ARCHIVE', entity: 'Project', entityId: id },
  });

  const io = getSocketInstance();
  if (io) io.to(`company:${companyId}`).emit('dashboard:refresh', { type: 'project_archived' });

  return archived;
}

export async function inviteMember(projectId: string, companyId: string, input: InviteMemberInput, invitedById: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const user = await prisma.user.findFirst({ where: { id: input.userId, companyId, status: 'ACTIVE' } });
  if (!user) throw { status: 404, message: 'User not found or not active', code: 'NOT_FOUND' };

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: input.userId } },
  });
  if (existing) throw { status: 409, message: 'User already a member', code: 'ALREADY_MEMBER' };

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: input.userId,
      role: input.role as 'PROJECT_ADMIN' | 'MEMBER',
      status: 'PENDING',
    },
  });

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: 'PROJECT_INVITATION',
      title: 'Project Invitation',
      body: `You have been invited to join project "${project.name}"`,
      link: `/projects/${projectId}`,
    },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`user:${input.userId}`).emit('project:invitation', { projectId, projectName: project.name, invitedById });
    io.to(`user:${input.userId}`).emit('notification:new', { type: 'PROJECT_INVITATION' });
  }

  await prisma.activityLog.create({
    data: { companyId, projectId, userId: invitedById, action: 'INVITE', entity: 'ProjectMember', entityId: input.userId },
  });

  return member;
}

export async function acceptInvitation(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: true },
  });
  if (!member) throw { status: 404, message: 'Invitation not found', code: 'NOT_FOUND' };
  if (member.status === 'ACCEPTED') throw { status: 400, message: 'Already accepted', code: 'ALREADY_ACCEPTED' };

  const updated = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { status: 'ACCEPTED', joinedAt: new Date() },
  });

  const io = getSocketInstance();
  if (io) {
    io.to(`project:${projectId}`).emit('project:member_joined', { userId, projectId });
  }

  await prisma.activityLog.create({
    data: {
      companyId: member.project.companyId,
      projectId,
      userId,
      action: 'ACCEPT',
      entity: 'ProjectMember',
      entityId: userId,
    },
  });

  return updated;
}

export async function removeMember(projectId: string, companyId: string, targetUserId: string, requesterId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  await prisma.projectMember.deleteMany({ where: { projectId, userId: targetUserId } });

  await prisma.activityLog.create({
    data: { companyId, projectId, userId: requesterId, action: 'REMOVE_MEMBER', entity: 'ProjectMember', entityId: targetUserId },
  });

  return { message: 'Member removed' };
}
