import { BrevoClient } from '@getbrevo/brevo';
import { env } from './env';

const brevo = new BrevoClient({ apiKey: env.BREVO_API_KEY });

async function send(to: string, toName: string, subject: string, html: string) {
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { email: env.BREVO_FROM_EMAIL, name: env.BREVO_FROM_NAME },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    });
    console.log(`✅ Email sent | to: ${to} | subject: "${subject}"`);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    console.error(
      `❌ Email failed | to: ${to} | subject: "${subject}" | code: ${e.statusCode ?? 'N/A'} | ${e.message ?? String(err)}`,
    );
    throw err;
  }
}

export async function sendInvitationEmail(
  to: string,
  fullName: string,
  inviteUrl: string,
  companyName: string,
) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>You're Invited!</title></head>
  <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; margin: 0;">Taskify</h1>
      </div>
      <h2 style="color: #1f2937;">You've been invited to ${companyName}!</h2>
      <p style="color: #6b7280;">Hi ${fullName},</p>
      <p style="color: #6b7280;">You have been invited to join <strong>${companyName}</strong> on Taskify. Click the button below to accept your invitation and set up your account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px;">This invitation expires in 24 hours. If you did not expect this, you can safely ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
    </div>
  </body>
  </html>`;

  await send(to, fullName, `You're invited to join ${companyName} on Taskify`, html);
}

export async function sendTaskAssignmentEmail(
  to: string,
  fullName: string,
  taskTitle: string,
  projectName: string,
  deadline: Date,
  taskUrl: string,
) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>New Task Assigned</title></head>
  <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; margin: 0;">Taskify</h1>
      </div>
      <h2 style="color: #1f2937;">New Task Assigned</h2>
      <p style="color: #6b7280;">Hi ${fullName},</p>
      <p style="color: #6b7280;">You have been assigned a new task in <strong>${projectName}</strong>.</p>
      <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: bold; color: #1f2937;">${taskTitle}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Deadline: ${deadline.toLocaleDateString()}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${taskUrl}" style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Task</a>
      </div>
    </div>
  </body>
  </html>`;

  await send(to, fullName, `New task assigned: ${taskTitle}`, html);
}

export async function sendAccountActivationEmail(
  to: string,
  fullName: string,
  activationUrl: string,
) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>Activate Your Account</title></head>
  <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; margin: 0;">Taskify</h1>
      </div>
      <h2 style="color: #1f2937;">Activate Your Account</h2>
      <p style="color: #6b7280;">Hi ${fullName},</p>
      <p style="color: #6b7280;">Welcome to Taskify! Please click the button below to activate your account and set your password.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${activationUrl}" style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Activate Account</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
  </body>
  </html>`;

  await send(to, fullName, 'Activate your Taskify account', html);
}
