import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { generateInvitationToken, getTokenExpiry } from '../../utils/crypto';
import { sendInvitationEmail } from '../../config/mailer';
import { env } from '../../config/env';
import type { RegisterInput, LoginInput, AcceptInviteInput } from './auth.schema';

export async function registerCompany(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email },
  });
  if (existing) {
    throw { status: 409, message: 'Email already registered', code: 'EMAIL_EXISTS' };
  }

  const company = await prisma.company.create({
    data: { name: input.companyName },
  });

  const passwordHash = await bcrypt.hash(input.password, 12);

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    },
  });

  const accessToken = generateAccessToken({ userId: admin.id, companyId: company.id, role: admin.role });
  const refreshToken = generateRefreshToken({ userId: admin.id, companyId: company.id, role: admin.role });

  return { accessToken, refreshToken, user: sanitizeUser(admin), company };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email },
    include: { company: true },
  });

  if (!user || !user.passwordHash) {
    throw { status: 401, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
  }

  if (user.status === 'DISABLED') {
    throw { status: 403, message: 'Account is disabled', code: 'ACCOUNT_DISABLED' };
  }

  if (user.status === 'PENDING') {
    throw { status: 403, message: 'Account not activated yet', code: 'ACCOUNT_PENDING' };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw { status: 401, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
  }

  const accessToken = generateAccessToken({ userId: user.id, companyId: user.companyId, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id, companyId: user.companyId, role: user.role });

  return { accessToken, refreshToken, user: sanitizeUser(user), company: user.company };
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw { status: 401, message: 'User not found or inactive', code: 'INVALID_TOKEN' };
  }

  const accessToken = generateAccessToken({ userId: user.id, companyId: user.companyId, role: user.role });
  const newRefreshToken = generateRefreshToken({ userId: user.id, companyId: user.companyId, role: user.role });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function acceptInvite(input: AcceptInviteInput) {
  const invitation = await prisma.invitationToken.findUnique({
    where: { token: input.token },
    include: { user: { include: { company: true } } },
  });

  if (!invitation) {
    throw { status: 404, message: 'Invitation not found', code: 'INVALID_TOKEN' };
  }
  if (invitation.usedAt) {
    throw { status: 400, message: 'Invitation already used', code: 'TOKEN_USED' };
  }
  if (invitation.expiresAt < new Date()) {
    throw { status: 400, message: 'Invitation expired', code: 'TOKEN_EXPIRED' };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const updatedUser = await prisma.user.update({
    where: { id: invitation.userId },
    data: {
      passwordHash,
      status: 'ACTIVE',
      fullName: input.fullName ?? invitation.user.fullName,
    },
  });

  await prisma.invitationToken.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() },
  });

  const accessToken = generateAccessToken({
    userId: updatedUser.id,
    companyId: updatedUser.companyId,
    role: updatedUser.role,
  });
  const refreshToken = generateRefreshToken({
    userId: updatedUser.id,
    companyId: updatedUser.companyId,
    role: updatedUser.role,
  });

  return { accessToken, refreshToken, user: sanitizeUser(updatedUser), company: invitation.user.company };
}

export async function getCurrentUser(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: { company: true },
  });
  if (!user) throw { status: 401, message: 'User not found', code: 'NOT_FOUND' };
  return { user: sanitizeUser(user), company: user.company };
}

export async function resendInvite(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: { company: true },
  });

  if (!user) {
    throw { status: 404, message: 'User not found', code: 'NOT_FOUND' };
  }
  if (user.status !== 'PENDING') {
    throw { status: 400, message: 'User is already active', code: 'ALREADY_ACTIVE' };
  }

  await prisma.invitationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateInvitationToken();
  await prisma.invitationToken.create({
    data: {
      userId,
      token,
      expiresAt: getTokenExpiry(24),
    },
  });

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite/${token}`;
  await sendInvitationEmail(user.email, user.fullName, inviteUrl, user.company.name);

  return { message: 'Invitation resent' };
}

function sanitizeUser(user: { id: string; companyId: string; fullName: string; email: string; role: string; status: string; department?: string | null; designation?: string | null; avatarUrl?: string | null }) {
  return {
    id: user.id,
    companyId: user.companyId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department,
    designation: user.designation,
    avatarUrl: user.avatarUrl,
  };
}
