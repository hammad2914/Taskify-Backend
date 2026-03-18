import { prisma } from '../../config/database';
import { generateInvitationToken, getTokenExpiry } from '../../utils/crypto';
import { sendInvitationEmail } from '../../config/mailer';
import { env } from '../../config/env';
import type { CreateUserInput, UpdateUserInput } from './users.schema';

export async function listUsers(
  companyId: string,
  page: number,
  limit: number,
  search?: string,
  department?: string,
  status?: string,
) {
  const where = {
    companyId,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(department && { department }),
    ...(status && { status: status as 'PENDING' | 'ACTIVE' | 'DISABLED' }),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyId: true,
        fullName: true,
        email: true,
        department: true,
        designation: true,
        avatarUrl: true,
        role: true,
        status: true,
        employeeId: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

export async function getUserById(id: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      companyId: true,
      fullName: true,
      email: true,
      department: true,
      designation: true,
      avatarUrl: true,
      role: true,
      status: true,
      employeeId: true,
      createdAt: true,
    },
  });
  if (!user) throw { status: 404, message: 'User not found', code: 'NOT_FOUND' };
  return user;
}

export async function createUser(input: CreateUserInput, companyId: string) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email, companyId },
  });
  if (existing) throw { status: 409, message: 'Email already in use in this company', code: 'EMAIL_EXISTS' };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw { status: 404, message: 'Company not found', code: 'NOT_FOUND' };

  const user = await prisma.user.create({
    data: {
      companyId,
      fullName: input.fullName,
      email: input.email,
      department: input.department,
      designation: input.designation,
      role: (input.role as 'MEMBER' | 'COMPANY_ADMIN') ?? 'MEMBER',
      status: 'PENDING',
    },
  });

  const token = generateInvitationToken();
  await prisma.invitationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getTokenExpiry(24),
    },
  });

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite/${token}`;
  try {
    await sendInvitationEmail(user.email, user.fullName, inviteUrl, company.name);
  } catch (e) {
    console.error('Failed to send invitation email:', e);
  }

  return user;
}

export async function updateUser(id: string, companyId: string, input: UpdateUserInput) {
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) throw { status: 404, message: 'User not found', code: 'NOT_FOUND' };

  return prisma.user.update({
    where: { id },
    data: input,
    select: {
      id: true,
      fullName: true,
      email: true,
      department: true,
      designation: true,
      avatarUrl: true,
      role: true,
      status: true,
    },
  });
}

export async function updateUserStatus(id: string, companyId: string, status: 'ACTIVE' | 'DISABLED') {
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) throw { status: 404, message: 'User not found', code: 'NOT_FOUND' };

  return prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  });
}

export async function deleteUser(id: string, companyId: string) {
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) throw { status: 404, message: 'User not found', code: 'NOT_FOUND' };

  await prisma.user.update({
    where: { id },
    data: { status: 'DISABLED' },
  });
  return { message: 'User deactivated' };
}
