import { prisma } from '../../config/database';

export async function listNotifications(userId: string, page = 1, limit = 20) {
  const [notifications, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
}

export async function markRead(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw { status: 404, message: 'Notification not found', code: 'NOT_FOUND' };

  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { message: 'All notifications marked as read' };
}
