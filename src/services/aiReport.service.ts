import { GoogleGenerativeAI } from '@google/generative-ai';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { env } from '../config/env';

interface ReportData {
  summary: string;
  keyMetrics: { label: string; value: string }[];
  risks: { level: 'HIGH' | 'MEDIUM' | 'LOW'; description: string }[];
  recommendations: string[];
  performanceScore: number;
}

interface ProjectContext {
  projectName: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  memberCount: number;
  tasksByStatus: Record<string, number>;
  completionRate: number;
  last10Activities: string[];
}

async function getProjectContext(projectId: string, companyId: string): Promise<ProjectContext> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      tasks: { select: { status: true } },
      members: { where: { status: 'ACCEPTED' } },
    },
  });

  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const activities = await prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: { select: { fullName: true } } },
  });

  const tasksByStatus: Record<string, number> = {};
  for (const task of project.tasks) {
    tasksByStatus[task.status] = (tasksByStatus[task.status] ?? 0) + 1;
  }

  const totalTasks = project.tasks.length;
  const completedTasks = tasksByStatus['COMPLETED'] ?? 0;
  const overdueTasks = tasksByStatus['OVERDUE'] ?? 0;

  return {
    projectName: project.name,
    startDate: project.startDate?.toISOString().split('T')[0] ?? 'N/A',
    endDate: project.endDate?.toISOString().split('T')[0] ?? 'N/A',
    totalTasks,
    completedTasks,
    overdueTasks,
    memberCount: project.members.length,
    tasksByStatus,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    last10Activities: activities.map((a) => `${a.user.fullName} ${a.action} ${a.entity}`),
  };
}

function buildPrompt(reportType: string, ctx: ProjectContext): string {
  return `Generate a ${reportType} report for the following project data:

Project: ${ctx.projectName}
Duration: ${ctx.startDate} to ${ctx.endDate}
Total Tasks: ${ctx.totalTasks}
Completed: ${ctx.completedTasks} (${ctx.completionRate}%)
Overdue: ${ctx.overdueTasks}
Team Members: ${ctx.memberCount}
Task Breakdown: ${JSON.stringify(ctx.tasksByStatus)}
Recent Activity: ${ctx.last10Activities.join(', ')}

Respond ONLY with valid JSON matching this schema:
{
  "summary": "string",
  "keyMetrics": [{ "label": "string", "value": "string" }],
  "risks": [{ "level": "HIGH|MEDIUM|LOW", "description": "string" }],
  "recommendations": ["string"],
  "performanceScore": 0-100
}`;
}

function generateMockReport(ctx: ProjectContext, reportType: string): ReportData {
  const score = Math.min(100, Math.max(0, ctx.completionRate + (ctx.overdueTasks > 0 ? -10 : 10)));
  return {
    summary: `${ctx.projectName} is a ${ctx.totalTasks}-task project with ${ctx.completionRate}% completion rate. ${ctx.overdueTasks} tasks are currently overdue.`,
    keyMetrics: [
      { label: 'Total Tasks', value: String(ctx.totalTasks) },
      { label: 'Completed', value: String(ctx.completedTasks) },
      { label: 'Overdue', value: String(ctx.overdueTasks) },
      { label: 'Completion Rate', value: `${ctx.completionRate}%` },
      { label: 'Team Size', value: String(ctx.memberCount) },
    ],
    risks: [
      ...(ctx.overdueTasks > 0 ? [{ level: 'HIGH' as const, description: `${ctx.overdueTasks} tasks are overdue and may impact project delivery` }] : []),
      ...(ctx.completionRate < 50 ? [{ level: 'MEDIUM' as const, description: 'Project completion rate is below 50%' }] : []),
      { level: 'LOW' as const, description: 'Regular monitoring recommended to maintain project velocity' },
    ],
    recommendations: [
      `Review and address ${ctx.overdueTasks} overdue tasks immediately`,
      'Schedule weekly team sync to track progress',
      `Current velocity suggests ${reportType === 'TIMELINE_ANALYSIS' ? 'timeline review may be needed' : 'continued focus on task completion'}`,
    ],
    performanceScore: score,
  };
}

export async function generateReport(
  projectId: string | undefined,
  companyId: string,
  createdById: string,
  reportType: string,
  title: string,
) {
  let reportData: ReportData;
  let context: ProjectContext | null = null;

  if (projectId) {
    context = await getProjectContext(projectId, companyId);
  }

  if (env.GEMINI_API_KEY && context) {
    console.log(`🤖 [AI Report] Calling Gemini (${env.GEMINI_MODEL}) for "${title}" [${reportType}]...`);
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: env.GEMINI_MODEL,
        systemInstruction: 'You are a professional project management analyst. Analyze the provided project data and generate a structured report in JSON format. Be concise, data-driven, and highlight actionable insights. Respond ONLY with valid JSON — no markdown fences, no extra text.',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = buildPrompt(reportType, context);
      const result = await model.generateContent(prompt);
      const content = result.response.text();
      if (!content) throw new Error('Empty Gemini response');
      reportData = JSON.parse(content) as ReportData;
      console.log(`✅ [AI Report] Gemini generated report successfully | score: ${reportData.performanceScore}/100`);
    } catch (e) {
      console.error('❌ [AI Report] Gemini failed — falling back to mock generator:', e);
      reportData = context ? generateMockReport(context, reportType) : generateMockReport({
        projectName: 'Unknown',
        startDate: 'N/A',
        endDate: 'N/A',
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        memberCount: 0,
        tasksByStatus: {},
        completionRate: 0,
        last10Activities: [],
      }, reportType);
      console.log(`⚠️  [AI Report] Using mock report | score: ${reportData.performanceScore}/100`);
    }
  } else {
    if (!env.GEMINI_API_KEY) {
      console.log('⚠️  [AI Report] GEMINI_API_KEY not set — using mock generator');
    } else if (!context) {
      console.log('⚠️  [AI Report] No project context available — using mock generator');
    }
    reportData = context
      ? generateMockReport(context, reportType)
      : generateMockReport({
          projectName: 'Company Report',
          startDate: 'N/A',
          endDate: 'N/A',
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          memberCount: 0,
          tasksByStatus: {},
          completionRate: 0,
          last10Activities: [],
        }, reportType);
  }

  const report = await prisma.report.create({
    data: {
      companyId,
      projectId,
      createdById,
      type: reportType as 'PROJECT_SUMMARY' | 'TIMELINE_ANALYSIS' | 'RISK_DETECTION' | 'USER_PERFORMANCE' | 'PRODUCTIVITY_INSIGHTS',
      title,
      data: reportData as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  return { report, data: reportData };
}

export async function listReports(companyId: string, projectId?: string) {
  return prisma.report.findMany({
    where: {
      companyId,
      ...(projectId && { projectId }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { fullName: true } },
      project: { select: { name: true } },
    },
  });
}

export function generatePdf(reportData: ReportData, title: string): Buffer {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#6366f1').fontSize(24).text('Taskify', { align: 'center' });
    doc.fillColor('#1f2937').fontSize(18).text(title, { align: 'center' });
    doc.fontSize(10).fillColor('#9ca3af').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    doc.fillColor('#1f2937').fontSize(14).text('Executive Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#6b7280').text(reportData.summary, { lineGap: 4 });
    doc.moveDown(1.5);

    // Performance Score
    doc.fillColor('#1f2937').fontSize(14).text('Performance Score');
    doc.moveDown(0.5);
    doc.fontSize(32).fillColor(reportData.performanceScore >= 70 ? '#22c55e' : reportData.performanceScore >= 40 ? '#f59e0b' : '#ef4444')
      .text(`${reportData.performanceScore}/100`, { align: 'center' });
    doc.moveDown(1.5);

    // Key Metrics
    doc.fillColor('#1f2937').fontSize(14).text('Key Metrics');
    doc.moveDown(0.5);
    for (const metric of reportData.keyMetrics) {
      doc.fontSize(11).fillColor('#374151').text(`• ${metric.label}: `, { continued: true }).fillColor('#6366f1').text(metric.value);
    }
    doc.moveDown(1.5);

    // Risks
    if (reportData.risks.length > 0) {
      doc.fillColor('#1f2937').fontSize(14).text('Risk Assessment');
      doc.moveDown(0.5);
      const riskColors: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' };
      for (const risk of reportData.risks) {
        doc.fontSize(11).fillColor(riskColors[risk.level] ?? '#6b7280').text(`[${risk.level}] `, { continued: true })
          .fillColor('#374151').text(risk.description, { lineGap: 3 });
      }
      doc.moveDown(1.5);
    }

    // Recommendations
    if (reportData.recommendations.length > 0) {
      doc.fillColor('#1f2937').fontSize(14).text('Recommendations');
      doc.moveDown(0.5);
      reportData.recommendations.forEach((rec, i) => {
        doc.fontSize(11).fillColor('#374151').text(`${i + 1}. ${rec}`, { lineGap: 4 });
      });
    }

    doc.end();
  }) as unknown as Buffer;
}
