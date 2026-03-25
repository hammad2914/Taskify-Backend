import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { buildReportHtml } from '../utils/pdfGenerator';

// ── Shared detail types ──────────────────────────────────────────────────────

export interface TaskDetail {
  title: string;
  status: string;
  priority: string;
  assignee: string;
  deadline: string;
  completedAt?: string;
  daysOverdue?: number;
  daysRemaining?: number;
}

export interface MemberPerformance {
  name: string;
  assigned: number;
  completed: number;
  overdue: number;
  inProgress: number;
  completionRate: number;
}

export interface ProjectSection {
  projectName: string;
  projectStatus: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
  memberCount: number;
  performanceScore: number;
  overdueTasks_list: TaskDetail[];
  topRisk: string;
}

export interface ReportData {
  summary: string;
  performanceScore: number;
  keyMetrics: { label: string; value: string }[];
  risks: { level: 'HIGH' | 'MEDIUM' | 'LOW'; description: string; affectedTasks?: string[] }[];
  recommendations: string[];
  taskHighlights: {
    overdueTasks: TaskDetail[];
    recentlyCompleted: TaskDetail[];
    atRiskTasks: TaskDetail[];
  };
  memberPerformance: MemberPerformance[];
  projectBreakdown?: ProjectSection[];   // only for company-wide
  velocityInsight: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Single-project context builder ───────────────────────────────────────────

async function getProjectContext(projectId: string, companyId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      tasks: {
        include: { assignee: { select: { fullName: true } } },
        orderBy: { deadline: 'asc' },
      },
      members: { where: { status: 'ACCEPTED' }, include: { user: { select: { id: true, fullName: true } } } },
    },
  });
  if (!project) throw { status: 404, message: 'Project not found', code: 'NOT_FOUND' };

  const now = new Date();

  const taskDetails: TaskDetail[] = project.tasks.map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee.fullName,
    deadline: t.deadline.toISOString().split('T')[0]!,
    completedAt: t.completedAt?.toISOString().split('T')[0],
    daysOverdue: t.status === 'OVERDUE' ? daysBetween(t.deadline, now) : undefined,
    daysRemaining: t.status !== 'COMPLETED' && t.status !== 'OVERDUE' ? daysBetween(now, t.deadline) : undefined,
  }));

  // Member performance
  const memberPerf: MemberPerformance[] = project.members.map((m) => {
    const memberTasks = project.tasks.filter((t) => t.assigneeId === m.userId);
    const completed  = memberTasks.filter((t) => t.status === 'COMPLETED').length;
    const overdue    = memberTasks.filter((t) => t.status === 'OVERDUE').length;
    const inProgress = memberTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    return {
      name: m.user.fullName,
      assigned: memberTasks.length,
      completed,
      overdue,
      inProgress,
      completionRate: memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0,
    };
  });

  const totalTasks   = project.tasks.length;
  const completedCnt = project.tasks.filter((t) => t.status === 'COMPLETED').length;
  const overdueCnt   = project.tasks.filter((t) => t.status === 'OVERDUE').length;

  return {
    projectName: project.name,
    projectStatus: project.status,
    startDate: project.startDate?.toISOString().split('T')[0] ?? 'N/A',
    endDate:   project.endDate?.toISOString().split('T')[0]   ?? 'N/A',
    totalTasks,
    completedTasks: completedCnt,
    overdueTasks:   overdueCnt,
    inProgressTasks: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    memberCount: project.members.length,
    completionRate: totalTasks > 0 ? Math.round((completedCnt / totalTasks) * 100) : 0,
    taskDetails,
    memberPerformance: memberPerf,
  };
}

// ── Company-wide context builder ─────────────────────────────────────────────

async function getCompanyContext(companyId: string) {
  const projects = await prisma.project.findMany({
    where: { companyId },
    include: {
      tasks: {
        include: { assignee: { select: { id: true, fullName: true } } },
        orderBy: { deadline: 'asc' },
      },
      members: { where: { status: 'ACCEPTED' }, include: { user: { select: { id: true, fullName: true } } } },
    },
  });

  const now = new Date();

  // Build per-project sections
  const projectBreakdown: ProjectSection[] = projects.map((p) => {
    const totalTasks   = p.tasks.length;
    const completedCnt = p.tasks.filter((t) => t.status === 'COMPLETED').length;
    const overdueCnt   = p.tasks.filter((t) => t.status === 'OVERDUE').length;
    const inProgressCnt = p.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completionRate = totalTasks > 0 ? Math.round((completedCnt / totalTasks) * 100) : 0;
    const score = Math.max(0, completionRate - overdueCnt * 8 + (inProgressCnt > 0 ? 5 : 0));

    const overdueList: TaskDetail[] = p.tasks
      .filter((t) => t.status === 'OVERDUE')
      .slice(0, 5)
      .map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee.fullName,
        deadline: t.deadline.toISOString().split('T')[0]!,
        daysOverdue: daysBetween(t.deadline, now),
      }));

    return {
      projectName: p.name,
      projectStatus: p.status,
      completionRate,
      totalTasks,
      completedTasks: completedCnt,
      overdueTasks: overdueCnt,
      inProgressTasks: inProgressCnt,
      memberCount: p.members.length,
      performanceScore: Math.min(100, score),
      overdueTasks_list: overdueList,
      topRisk: overdueCnt > 0
        ? `${overdueCnt} overdue task${overdueCnt > 1 ? 's' : ''} (${overdueList.map(t => t.title).join(', ')})`
        : completionRate < 40
        ? 'Low completion rate — project may be behind schedule'
        : 'No critical risks identified',
    };
  });

  // Company-wide aggregates
  const allTasks = projects.flatMap((p) => p.tasks);
  const totalTasks     = allTasks.length;
  const completedTotal = allTasks.filter((t) => t.status === 'COMPLETED').length;
  const overdueTotal   = allTasks.filter((t) => t.status === 'OVERDUE').length;
  const inProgTotal    = allTasks.filter((t) => t.status === 'IN_PROGRESS').length;

  // Cross-project member performance
  const memberMap = new Map<string, { name: string; assigned: number; completed: number; overdue: number; inProgress: number }>();
  for (const p of projects) {
    for (const t of p.tasks) {
      const key  = t.assignee.id;
      const name = t.assignee.fullName;
      if (!memberMap.has(key)) memberMap.set(key, { name, assigned: 0, completed: 0, overdue: 0, inProgress: 0 });
      const m = memberMap.get(key)!;
      m.assigned++;
      if (t.status === 'COMPLETED')   m.completed++;
      if (t.status === 'OVERDUE')     m.overdue++;
      if (t.status === 'IN_PROGRESS') m.inProgress++;
    }
  }
  const memberPerformance: MemberPerformance[] = Array.from(memberMap.values()).map((m) => ({
    ...m,
    completionRate: m.assigned > 0 ? Math.round((m.completed / m.assigned) * 100) : 0,
  })).sort((a, b) => b.completionRate - a.completionRate);

  // Task details for highlights
  const taskDetails: TaskDetail[] = allTasks.map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee.fullName,
    deadline: t.deadline.toISOString().split('T')[0]!,
    completedAt: t.completedAt?.toISOString().split('T')[0],
    daysOverdue: t.status === 'OVERDUE' ? daysBetween(t.deadline, now) : undefined,
    daysRemaining: t.status !== 'COMPLETED' && t.status !== 'OVERDUE' ? daysBetween(now, t.deadline) : undefined,
  }));

  return {
    projectName: 'Company Overview',
    projectStatus: 'ACTIVE',
    startDate: 'N/A',
    endDate: 'N/A',
    totalTasks,
    completedTasks: completedTotal,
    overdueTasks: overdueTotal,
    inProgressTasks: inProgTotal,
    memberCount: memberMap.size,
    completionRate: totalTasks > 0 ? Math.round((completedTotal / totalTasks) * 100) : 0,
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'ACTIVE').length,
    taskDetails,
    memberPerformance,
    projectBreakdown,
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(reportType: string, ctx: Awaited<ReturnType<typeof getProjectContext>> | Awaited<ReturnType<typeof getCompanyContext>>): string {
  const isCompany = 'totalProjects' in ctx;
  const now = new Date();

  const overdueTasks  = ctx.taskDetails.filter((t) => t.status === 'OVERDUE');
  const recentDone    = ctx.taskDetails
    .filter((t) => t.status === 'COMPLETED' && t.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 8);
  const atRisk        = ctx.taskDetails
    .filter((t) => t.daysRemaining !== undefined && t.daysRemaining >= 0 && t.daysRemaining <= 5)
    .slice(0, 6);
  const inProgress    = ctx.taskDetails.filter((t) => t.status === 'IN_PROGRESS').slice(0, 8);

  const scope = isCompany
    ? `Company-wide across ${(ctx as typeof ctx & { totalProjects: number }).totalProjects} projects`
    : `Project: ${ctx.projectName} (${ctx.projectStatus})`;

  let contextBlock = `
=== REPORT CONTEXT ===
Report Type: ${reportType}
Scope: ${scope}
Analysis Date: ${now.toISOString().split('T')[0]}
Timeline: ${ctx.startDate} → ${ctx.endDate}

=== TASK STATISTICS ===
Total Tasks: ${ctx.totalTasks}
Completed: ${ctx.completedTasks} (${ctx.completionRate}%)
In Progress: ${ctx.inProgressTasks}
Overdue: ${ctx.overdueTasks}
Pending/Accepted: ${ctx.totalTasks - ctx.completedTasks - ctx.inProgressTasks - ctx.overdueTasks}
Team Members: ${ctx.memberCount}

=== OVERDUE TASKS (Action Required) ===
${overdueTasks.length === 0 ? 'None' : overdueTasks.map((t) => `- "${t.title}" | Assignee: ${t.assignee} | Priority: ${t.priority} | ${t.daysOverdue}d overdue`).join('\n')}

=== IN-PROGRESS TASKS ===
${inProgress.length === 0 ? 'None' : inProgress.map((t) => `- "${t.title}" | Assignee: ${t.assignee} | Priority: ${t.priority} | Due: ${t.deadline}${t.daysRemaining !== undefined ? ` (${t.daysRemaining}d remaining)` : ''}`).join('\n')}

=== AT-RISK TASKS (Due ≤5 days) ===
${atRisk.length === 0 ? 'None' : atRisk.map((t) => `- "${t.title}" | Assignee: ${t.assignee} | Due: ${t.deadline} | ${t.daysRemaining}d left`).join('\n')}

=== RECENTLY COMPLETED TASKS ===
${recentDone.length === 0 ? 'None' : recentDone.map((t) => `- "${t.title}" | Assignee: ${t.assignee} | Completed: ${t.completedAt}`).join('\n')}

=== MEMBER PERFORMANCE ===
${ctx.memberPerformance.map((m) => `- ${m.name}: ${m.assigned} assigned, ${m.completed} completed (${m.completionRate}%), ${m.overdue} overdue, ${m.inProgress} in-progress`).join('\n')}
`;

  if (isCompany && 'projectBreakdown' in ctx) {
    const ctxCompany = ctx as typeof ctx & { projectBreakdown: ProjectSection[] };
    contextBlock += `
=== PER-PROJECT BREAKDOWN ===
${ctxCompany.projectBreakdown.map((p) => `
${p.projectName} [${p.projectStatus}]
  Tasks: ${p.totalTasks} total | ${p.completedTasks} done (${p.completionRate}%) | ${p.overdueTasks} overdue | ${p.inProgressTasks} in-progress
  Score: ${p.performanceScore}/100 | Members: ${p.memberCount}
  Top Risk: ${p.topRisk}`).join('\n')}
`;
  }

  const schema = `{
  "summary": "2-3 paragraph executive summary. Mention specific task names, member names, and concrete numbers. Be analytical, not generic.",
  "performanceScore": <integer 0-100 based on data>,
  "keyMetrics": [
    { "label": "Completion Rate",     "value": "${ctx.completionRate}%" },
    { "label": "Overdue Tasks",       "value": "${ctx.overdueTasks}" },
    { "label": "Team Velocity",       "value": "<tasks/week estimate>" },
    { "label": "At-Risk Tasks",       "value": "${atRisk.length}" },
    { "label": "Team Size",           "value": "${ctx.memberCount}" },
    { "label": "Top Performer",       "value": "<member name with highest completion rate>" }
  ],
  "risks": [
    { "level": "HIGH|MEDIUM|LOW", "description": "<specific risk with task/member names>", "affectedTasks": ["task name 1", "task name 2"] }
  ],
  "recommendations": [
    "<Specific actionable recommendation mentioning task or member names>"
  ],
  "taskHighlights": {
    "overdueTasks": ${JSON.stringify(overdueTasks.slice(0, 6))},
    "recentlyCompleted": ${JSON.stringify(recentDone.slice(0, 6))},
    "atRiskTasks": ${JSON.stringify(atRisk.slice(0, 6))}
  },
  "memberPerformance": ${JSON.stringify(ctx.memberPerformance)},
  ${isCompany && 'projectBreakdown' in ctx ? `"projectBreakdown": ${JSON.stringify((ctx as typeof ctx & { projectBreakdown: ProjectSection[] }).projectBreakdown)},` : '"projectBreakdown": null,'}
  "velocityInsight": "<one sharp sentence about team velocity and trend>"
}`;

  return `You are a senior project management analyst. Analyze the following real project data and generate a deeply insightful ${reportType} report.

${contextBlock}

=== INSTRUCTIONS ===
- Be specific: name actual tasks, mention real team members, use real numbers
- The summary must reference actual task names from the overdue/in-progress lists
- Risks must reference actual task names and assignees
- Recommendations must be actionable (e.g. "Escalate '${overdueTasks[0]?.title ?? 'overdue task'}' assigned to ${overdueTasks[0]?.assignee ?? 'assignee'}")
- Do NOT generate generic text — every sentence must be grounded in the data above
- Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):

${schema}`;
}

// ── Mock report generator (when Gemini unavailable) ───────────────────────────

function generateMockReport(
  ctx: Awaited<ReturnType<typeof getProjectContext>> | Awaited<ReturnType<typeof getCompanyContext>>,
  reportType: string,
): ReportData {
  const now = new Date();
  const overdueTasks  = ctx.taskDetails.filter((t) => t.status === 'OVERDUE');
  const recentDone    = ctx.taskDetails.filter((t) => t.status === 'COMPLETED' && t.completedAt)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 6);
  const atRisk        = ctx.taskDetails.filter((t) => t.daysRemaining !== undefined && t.daysRemaining >= 0 && t.daysRemaining <= 5).slice(0, 6);
  const topPerformer  = ctx.memberPerformance.sort((a, b) => b.completionRate - a.completionRate)[0];
  const score         = Math.min(100, Math.max(10, ctx.completionRate - overdueTasks.length * 8 + (ctx.memberPerformance.length > 0 ? 5 : 0)));

  const overdueNames  = overdueTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ');

  return {
    summary: `${ctx.projectName} currently has ${ctx.completionRate}% completion rate across ${ctx.totalTasks} tasks with ${ctx.memberCount} team members. ` +
      (overdueTasks.length > 0
        ? `There are ${overdueTasks.length} overdue tasks requiring immediate attention: ${overdueNames}. These represent a delivery risk and should be prioritised by the team.`
        : 'No tasks are currently overdue, indicating healthy project velocity and good timeline management.') +
      (topPerformer ? ` Top contributor is ${topPerformer.name} with a ${topPerformer.completionRate}% completion rate (${topPerformer.completed}/${topPerformer.assigned} tasks done).` : ''),

    performanceScore: score,

    keyMetrics: [
      { label: 'Completion Rate',     value: `${ctx.completionRate}%` },
      { label: 'Overdue Tasks',       value: String(overdueTasks.length) },
      { label: 'In Progress',         value: String(ctx.inProgressTasks) },
      { label: 'At-Risk Tasks',       value: String(atRisk.length) },
      { label: 'Team Size',           value: String(ctx.memberCount) },
      { label: 'Top Performer',       value: topPerformer?.name ?? 'N/A' },
      { label: 'Recently Completed',  value: String(recentDone.length) },
      { label: 'Report Type',         value: reportType.replace(/_/g, ' ') },
    ],

    risks: [
      ...(overdueTasks.length > 0 ? [{
        level: 'HIGH' as const,
        description: `${overdueTasks.length} task(s) are past their deadline: ${overdueNames}. This risks the overall project delivery timeline.`,
        affectedTasks: overdueTasks.slice(0, 4).map((t) => t.title),
      }] : []),
      ...(atRisk.length > 0 ? [{
        level: 'MEDIUM' as const,
        description: `${atRisk.length} task(s) are due within 5 days and may become overdue: ${atRisk.map(t => `"${t.title}"`).join(', ')}.`,
        affectedTasks: atRisk.map((t) => t.title),
      }] : []),
      ...(ctx.completionRate < 40 ? [{
        level: 'MEDIUM' as const,
        description: `Project completion rate (${ctx.completionRate}%) is below the 40% threshold, suggesting the team may be behind schedule.`,
        affectedTasks: [],
      }] : []),
      {
        level: 'LOW' as const,
        description: 'Regular weekly syncs are recommended to maintain visibility into task progress and blockers.',
        affectedTasks: [],
      },
    ],

    recommendations: [
      ...(overdueTasks.length > 0 ? [`Immediately address overdue tasks: start with "${overdueTasks[0]?.title}" assigned to ${overdueTasks[0]?.assignee} (${overdueTasks[0]?.daysOverdue}d overdue, ${overdueTasks[0]?.priority} priority).`] : []),
      ...(atRisk.length > 0 ? [`Protect at-risk tasks — "${atRisk[0]?.title}" is due in ${atRisk[0]?.daysRemaining} day(s). Check blockers with ${atRisk[0]?.assignee} today.`] : []),
      ...(ctx.memberPerformance.filter(m => m.overdue > 1).map(m => `Review workload for ${m.name} who has ${m.overdue} overdue tasks (${m.completionRate}% completion rate).`)).slice(0, 2),
      'Schedule a retrospective to review task estimation accuracy and improve deadline realism.',
      `Focus on closing the ${ctx.inProgressTasks} in-progress tasks before starting new work to reduce WIP.`,
    ].filter(Boolean).slice(0, 5),

    taskHighlights: {
      overdueTasks:       overdueTasks.slice(0, 6),
      recentlyCompleted:  recentDone.slice(0, 6),
      atRiskTasks:        atRisk.slice(0, 6),
    },

    memberPerformance: ctx.memberPerformance,

    projectBreakdown: 'projectBreakdown' in ctx
      ? (ctx as typeof ctx & { projectBreakdown: ProjectSection[] }).projectBreakdown
      : undefined,

    velocityInsight: recentDone.length > 0
      ? `${recentDone.length} tasks completed recently — team is ${ctx.completionRate >= 60 ? 'on track' : 'below target pace'}; ${overdueTasks.length > 0 ? 'overdue backlog needs immediate clearing' : 'maintain current momentum'}.`
      : 'No tasks completed recently — consider reviewing blockers and team capacity.',
  };
}

// ── Main generate function ────────────────────────────────────────────────────

export async function generateReport(
  projectId: string | undefined,
  companyId: string,
  createdById: string,
  reportType: string,
  title: string,
) {
  let reportData: ReportData;
  const context = projectId
    ? await getProjectContext(projectId, companyId)
    : await getCompanyContext(companyId);

  if (env.GEMINI_API_KEY) {
    console.log(`🤖 [AI Report] Calling Gemini (${env.GEMINI_MODEL}) for "${title}" [${reportType}]...`);
    try {
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const prompt = buildPrompt(reportType, context);
      const result = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction:
            'You are a senior project management analyst. Generate a deeply specific, data-driven report in JSON. Every insight must reference real task names and member names from the provided data. Respond ONLY with valid JSON — no markdown fences, no extra text.',
        },
      });
      const content = result.text;
      if (!content) throw new Error('Empty Gemini response');
      reportData = JSON.parse(content) as ReportData;
      console.log(`✅ [AI Report] Gemini generated report successfully | score: ${reportData.performanceScore}/100`);
    } catch (e) {
      console.error('❌ [AI Report] Gemini failed — falling back to mock generator:', e);
      reportData = generateMockReport(context, reportType);
      console.log(`⚠️  [AI Report] Using mock report | score: ${reportData.performanceScore}/100`);
    }
  } else {
    console.log('⚠️  [AI Report] GEMINI_API_KEY not set — using mock generator');
    reportData = generateMockReport(context, reportType);
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

// ── List / download helpers ───────────────────────────────────────────────────

export async function listReports(companyId: string, projectId?: string) {
  return prisma.report.findMany({
    where: { companyId, ...(projectId && { projectId }) },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { fullName: true } }, project: { select: { name: true } } },
  });
}

export async function generatePdf(reportData: ReportData, title: string): Promise<Buffer> {
  const html = buildReportHtml(reportData, title);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
