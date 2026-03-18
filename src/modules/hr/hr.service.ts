import { prisma } from '../../config/database';
import { hrResponseSchema } from './hr.schema';
import { generateInvitationToken, getTokenExpiry } from '../../utils/crypto';
import { sendInvitationEmail } from '../../config/mailer';
import { env } from '../../config/env';

export async function testConnection(hrApiUrl: string) {
  const response = await fetch(hrApiUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw { status: 400, message: `HR API returned ${response.status}`, code: 'HR_API_ERROR' };
  }

  const data = await response.json() as unknown;
  const result = hrResponseSchema.safeParse(data);
  if (!result.success) {
    throw {
      status: 400,
      message: 'HR API response format is invalid. Expected array with fields: employeeId, fullName, email, department, designation, status',
      code: 'INVALID_HR_FORMAT',
    };
  }

  return { valid: true, employeeCount: result.data.length, sampleData: result.data.slice(0, 3) };
}

export async function syncEmployees(companyId: string, hrApiUrl: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw { status: 404, message: 'Company not found', code: 'NOT_FOUND' };

  const response = await fetch(hrApiUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw { status: 400, message: `HR API returned ${response.status}`, code: 'HR_API_ERROR' };

  const data = await response.json() as unknown;
  const result = hrResponseSchema.safeParse(data);
  if (!result.success) throw { status: 400, message: 'Invalid HR API format', code: 'INVALID_HR_FORMAT' };

  const employees = result.data;
  let created = 0;
  let updated = 0;
  let invited = 0;

  for (const emp of employees) {
    const existing = await prisma.user.findFirst({
      where: { companyId, email: emp.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: emp.fullName,
          department: emp.department,
          designation: emp.designation,
          employeeId: emp.employeeId,
          status: emp.status === 'active' ? 'ACTIVE' : 'DISABLED',
        },
      });
      updated++;
    } else {
      const user = await prisma.user.create({
        data: {
          companyId,
          employeeId: emp.employeeId,
          fullName: emp.fullName,
          email: emp.email,
          department: emp.department,
          designation: emp.designation,
          status: 'PENDING',
          role: 'MEMBER',
        },
      });

      if (emp.status === 'active') {
        const token = generateInvitationToken();
        await prisma.invitationToken.create({
          data: { userId: user.id, token, expiresAt: getTokenExpiry(24) },
        });
        const inviteUrl = `${env.FRONTEND_URL}/accept-invite/${token}`;
        try {
          await sendInvitationEmail(user.email, user.fullName, inviteUrl, company.name);
          invited++;
        } catch (e) {
          console.error('Failed to send invitation:', e);
        }
      }
      created++;
    }
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { hrApiUrl, hrApiConnected: true },
  });

  return { created, updated, invited, total: employees.length };
}

export async function getHrStatus(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { hrApiUrl: true, hrApiConnected: true },
  });
  return company;
}
