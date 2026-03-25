import type { ReportData, TaskDetail, MemberPerformance, ProjectSection } from '../services/aiReport.service';

// ── Colour helpers ────────────────────────────────────────────────────────────

function sc(score: number) {
  return score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
}

function priorityColor(p: string) {
  return ({ CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#3B82F6' } as Record<string, string>)[p] ?? '#9CA3AF';
}

function riskStyle(level: string): { bg: string; border: string; color: string; badge: string } {
  return ({
    HIGH:   { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', badge: '#EF4444' },
    MEDIUM: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', badge: '#F59E0B' },
    LOW:    { bg: '#F0FDF4', border: '#A7F3D0', color: '#065F46', badge: '#10B981' },
  } as Record<string, { bg: string; border: string; color: string; badge: string }>)[level]
    ?? { bg: '#F9FAFB', border: '#E5E7EB', color: '#374151', badge: '#9CA3AF' };
}

function initial(name: string) {
  return name.charAt(0).toUpperCase();
}

// ── Sub-template helpers ──────────────────────────────────────────────────────

function taskRows(tasks: TaskDetail[], variant: 'overdue' | 'risk' | 'done'): string {
  if (!tasks || tasks.length === 0) {
    const labels = { overdue: '🎉 No overdue tasks', risk: 'No at-risk tasks', done: 'No completed tasks yet' };
    return `<div class="empty-state">${labels[variant]}</div>`;
  }
  return tasks.map((t) => {
    const bgColors = { overdue: '#FFF5F5', risk: '#FFFBF0', done: '#F0FDF4' };
    const borderColors = { overdue: '#EF4444', risk: '#F59E0B', done: '#10B981' };
    const meta = variant === 'overdue' && t.daysOverdue !== undefined
      ? `<span style="color:#EF4444;font-weight:600">${t.daysOverdue}d overdue</span>`
      : variant === 'done' && t.completedAt
      ? `<span style="color:#10B981">✓ ${t.completedAt}</span>`
      : variant === 'risk' && t.daysRemaining !== undefined
      ? `<span style="color:#F59E0B;font-weight:600">${t.daysRemaining}d left</span>`
      : '';
    return `
      <div style="display:flex;align-items:flex-start;gap:6px;padding:7px 8px;margin-bottom:4px;
                  background:${bgColors[variant]};border-radius:7px;border-left:3px solid ${borderColors[variant]};">
        <div style="width:6px;height:6px;border-radius:50%;background:${priorityColor(t.priority)};flex-shrink:0;margin-top:4px"></div>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="font-size:10.5px;font-weight:600;color:#1F2937;word-break:break-word;line-height:1.3">${t.title}</div>
          <div style="font-size:9.5px;color:#9CA3AF;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.assignee} · ${meta}</div>
        </div>
      </div>`;
  }).join('');
}

function memberTable(members: MemberPerformance[]): string {
  if (!members || members.length === 0) return '<p style="color:#9CA3AF;font-size:12px">No member data available.</p>';
  const sorted = [...members].sort((a, b) => b.completionRate - a.completionRate);
  const rows = sorted.map((m, i) => `
    <tr style="background:${i % 2 === 0 ? 'white' : '#F9FAFB'}">
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);
                      color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${initial(m.name)}
          </div>
          <span style="font-size:12px;font-weight:600;color:#1F2937">${m.name}</span>
        </div>
      </td>
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;text-align:center;font-family:monospace;font-size:12px;font-weight:600;color:#374151">${m.assigned}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;text-align:center;font-family:monospace;font-size:12px;font-weight:600;color:#10B981">${m.completed}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;text-align:center;font-family:monospace;font-size:12px;font-weight:600;color:#6366F1">${m.inProgress}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;text-align:center;font-family:monospace;font-size:12px;font-weight:600;color:${m.overdue > 0 ? '#EF4444' : '#9CA3AF'}">${m.overdue}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;min-width:110px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${m.completionRate}%;background:${sc(m.completionRate)};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;font-family:monospace;min-width:32px;text-align:right;color:${sc(m.completionRate)}">${m.completionRate}%</span>
        </div>
      </td>
    </tr>`).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px;border-radius:10px;overflow:hidden;border:1px solid #E5E7EB">
      <thead>
        <tr>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:left">Member</th>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:center">Assigned</th>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:center">Completed</th>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:center">In Progress</th>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:center">Overdue</th>
          <th style="background:linear-gradient(90deg,#6366F1,#8B5CF6);color:white;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:11px 12px;text-align:left">Completion Rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function projectCards(projects: ProjectSection[]): string {
  return projects.map((p) => {
    const color = sc(p.performanceScore);
    const overdueTasks = p.overdueTasks_list ?? [];
    const circum = 2 * Math.PI * 20;
    const dash = (p.completionRate / 100) * circum;
    return `
      <div style="border:1px solid #E5E7EB;border-radius:12px;margin-bottom:14px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span style="color:white;font-size:14px;font-weight:800">${p.projectName.charAt(0)}</span>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#1F2937">${p.projectName}</div>
              <div style="font-size:10px;color:#9CA3AF;margin-top:1px">${p.projectStatus} · ${p.memberCount} members</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:14px">
            <div style="text-align:right">
              <div style="font-size:20px;font-weight:800;font-family:monospace;color:${color}">${p.performanceScore}/100</div>
              <div style="font-size:10px;color:#9CA3AF">${p.completionRate}% complete</div>
            </div>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" stroke-width="5"/>
              <circle cx="24" cy="24" r="20" fill="none" stroke="${color}" stroke-width="5"
                stroke-dasharray="${dash} ${circum}" stroke-linecap="round"
                transform="rotate(-90 24 24)"/>
              <text x="24" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="${color}"
                font-family="monospace">${p.completionRate}%</text>
            </svg>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr)">
          ${[
            { label: 'Total', value: p.totalTasks, color: '#374151' },
            { label: 'Done', value: p.completedTasks, color: '#10B981' },
            { label: 'In Progress', value: p.inProgressTasks, color: '#6366F1' },
            { label: 'Overdue', value: p.overdueTasks, color: p.overdueTasks > 0 ? '#EF4444' : '#9CA3AF' },
          ].map((s, i) => `
            <div style="padding:10px 14px;text-align:center;${i < 3 ? 'border-right:1px solid #F3F4F6' : ''}">
              <div style="font-size:20px;font-weight:800;font-family:monospace;color:${s.color}">${s.value}</div>
              <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-top:2px">${s.label}</div>
            </div>`).join('')}
        </div>
        ${overdueTasks.length > 0 ? `
          <div style="background:#FFFBF0;border-top:1px solid #FDE68A;padding:8px 14px">
            <span style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.8px">Overdue: </span>
            <span style="font-size:10px;color:#92400E">${overdueTasks.map(t => `"${t.title}" (${t.assignee})`).join(' · ')}</span>
          </div>` : `
          <div style="background:#F0FDF4;border-top:1px solid #A7F3D0;padding:8px 14px">
            <span style="font-size:10px;font-weight:600;color:#065F46">✓ No overdue tasks — ${p.topRisk}</span>
          </div>`}
      </div>`;
  }).join('');
}

function sectionHeader(title: string, subtitle?: string): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #E0E7FF">
      <div style="width:4px;height:18px;background:linear-gradient(#6366F1,#8B5CF6);border-radius:2px;flex-shrink:0"></div>
      <div>
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6366F1">${title}</div>
        ${subtitle ? `<div style="font-size:10px;color:#9CA3AF;margin-top:1px">${subtitle}</div>` : ''}
      </div>
    </div>`;
}

function pageHeader(title: string, subtitle: string): string {
  return `
    <div style="background:linear-gradient(90deg,#6366F1,#8B5CF6);padding:20px 36px 16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700;color:white;letter-spacing:0.5px">${title}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.55);font-family:monospace">${subtitle}</div>
    </div>`;
}

function pageFooter(page: number, total: number, title: string): string {
  return `
    <div style="position:absolute;bottom:22px;left:36px;right:36px;display:flex;align-items:center;justify-content:space-between;
                font-size:10px;color:#D1D5DB;border-top:1px solid #F3F4F6;padding-top:10px">
      <span style="font-weight:700;color:#6366F1">TASKIFY</span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;text-align:center">${title}</span>
      <span style="font-family:monospace">Page ${page} / ${total}</span>
    </div>`;
}

// ── Main HTML builder ─────────────────────────────────────────────────────────

export function buildReportHtml(rd: ReportData, title: string): string {
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const generatedShort = new Date().toLocaleDateString('en-GB');
  const scoreColor = sc(rd.performanceScore);

  const overdueList  = rd.taskHighlights?.overdueTasks      ?? [];
  const atRiskList   = rd.taskHighlights?.atRiskTasks        ?? [];
  const recentDone   = rd.taskHighlights?.recentlyCompleted  ?? [];
  const members      = rd.memberPerformance                  ?? [];
  const risks        = rd.risks                              ?? [];
  const recs         = rd.recommendations                    ?? [];
  const projects     = rd.projectBreakdown                   ?? [];
  const metrics      = rd.keyMetrics                         ?? [];

  const hasProjects = projects.length > 0;
  const totalPages  = hasProjects ? 5 : 4;

  // ── SVG Score gauge ──
  const R = 60, CX = 80, CY = 80;
  const circum = 2 * Math.PI * R;
  const dash    = (rd.performanceScore / 100) * circum * 0.75;
  const gapStart = circum * 0.75;

  // ── Metrics cards ──
  const metricCards = metrics.map((m) => `
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;text-align:center">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:8px">${m.label}</div>
      <div style="font-size:20px;font-weight:800;font-family:monospace;color:#1F2937">${m.value}</div>
    </div>`).join('');

  // ── Risk blocks ──
  const riskBlocks = risks.map((r) => {
    const rs = riskStyle(r.level);
    const affected = r.affectedTasks?.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
        ${r.affectedTasks.map(t => `<span style="font-size:9px;font-family:monospace;padding:2px 7px;border-radius:4px;background:rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.08)">${t}</span>`).join('')}
      </div>` : '';
    return `
      <div style="border-radius:10px;padding:13px 15px;margin-bottom:10px;background:${rs.bg};border:1px solid ${rs.border}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:3px 8px;border-radius:4px;
                       background:${rs.badge};color:white;font-family:monospace">${r.level}</span>
          <span style="font-size:12px;font-weight:600;color:${rs.color}">${r.description}</span>
        </div>
        ${affected}
      </div>`;
  }).join('');

  // ── Recommendation items ──
  const recItems = recs.map((rec, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:10px;background:#F9FAFB;border:1px solid #E5E7EB;margin-bottom:10px">
      <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;
                  font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i + 1}</div>
      <p style="font-size:12px;line-height:1.65;color:#374151;margin:0;flex:1">${rec}</p>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,sans-serif;color:#1F2937;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:0;size:A4}
    .page{width:210mm;min-height:297mm;position:relative;overflow:hidden;page-break-after:always}
    .page:last-child{page-break-after:auto}
    .page-inner{padding:28px 36px 68px;overflow:hidden}
  </style>
</head>
<body>

<!-- ════════════════════════════════════════════════════════════════════════
     PAGE 1 — COVER
════════════════════════════════════════════════════════════════════════ -->
<div class="page" style="background:linear-gradient(145deg,#080C14 0%,#0D1220 55%,#1A2438 100%);
     display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 48px;text-align:center">

  <!-- Logo -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:52px">
    <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:12px;
                display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white">T</div>
    <div style="font-size:30px;font-weight:800;background:linear-gradient(135deg,#6366F1,#A78BFA);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent">TASKIFY</div>
  </div>

  <!-- Report label -->
  <div style="font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:14px">
    AI-Generated Report
  </div>

  <!-- Title -->
  <h1 style="font-size:30px;font-weight:800;color:white;line-height:1.2;margin-bottom:8px;max-width:520px">${title}</h1>
  <div style="font-size:13px;color:rgba(255,255,255,0.35);font-family:'JetBrains Mono',monospace;margin-bottom:56px">${generated}</div>

  <!-- Score gauge -->
  <div style="position:relative;margin-bottom:48px">
    <svg width="160" height="160" viewBox="0 0 160 160">
      <!-- Glowing outer ring -->
      <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(99,102,241,0.08)" stroke-width="1"/>
      <!-- Track -->
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"
        stroke-dasharray="${circum * 0.75} ${circum * 0.25}" stroke-linecap="round"
        transform="rotate(135 80 80)"/>
      <!-- Progress -->
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="${scoreColor}" stroke-width="12"
        stroke-dasharray="${dash} ${gapStart + (circum - circum * 0.75)}" stroke-linecap="round"
        transform="rotate(135 80 80)"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:8px">
      <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${scoreColor};line-height:1">${rd.performanceScore}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:1px">/ 100</div>
    </div>
  </div>

  <!-- Summary stats row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;width:100%;max-width:560px">
    ${[
      { label: 'Total Tasks',  value: metrics.find(m => m.label === 'Total Tasks')?.value ?? (overdueList.length + atRiskList.length + recentDone.length) },
      { label: 'Overdue',      value: overdueList.length },
      { label: 'At Risk',      value: atRiskList.length },
      { label: 'Team Members', value: members.length },
    ].map(({ label, value }) => `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">
        <div style="font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:6px">${label}</div>
        <div style="font-size:24px;font-weight:800;color:white;font-family:'JetBrains Mono',monospace">${value}</div>
      </div>`).join('')}
  </div>

  <!-- Footer bar -->
  <div style="position:absolute;bottom:32px;left:48px;right:48px;display:flex;justify-content:space-between;
              font-size:10px;color:rgba(255,255,255,0.2);font-family:'JetBrains Mono',monospace;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px">
    <span>CONFIDENTIAL — INTERNAL USE ONLY</span>
    <span>${generatedShort} · Page 1 / ${totalPages}</span>
  </div>
</div>


<!-- ════════════════════════════════════════════════════════════════════════
     PAGE 2 — EXECUTIVE SUMMARY + KEY METRICS
════════════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader('Executive Summary', generatedShort)}
  <div class="page-inner">

    ${sectionHeader('AI Analysis')}
    <p style="font-size:13px;line-height:1.85;color:#374151;margin-bottom:16px">${rd.summary}</p>

    ${rd.velocityInsight ? `
    <div style="display:flex;align-items:flex-start;gap:10px;background:#EEF2FF;border-left:4px solid #6366F1;
                border-radius:4px;padding:12px 16px;margin-bottom:24px">
      <span style="font-size:14px;flex-shrink:0">⚡</span>
      <p style="font-size:12px;color:#4338CA;font-style:italic;line-height:1.6;margin:0">${rd.velocityInsight}</p>
    </div>` : ''}

    ${sectionHeader('Key Performance Metrics', `${metrics.length} indicators`)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:0">
      ${metricCards}
    </div>
  </div>
  ${pageFooter(2, totalPages, title)}
</div>


<!-- ════════════════════════════════════════════════════════════════════════
     PAGE 3 — TASK HIGHLIGHTS + MEMBER PERFORMANCE
════════════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader('Task Highlights & Team Performance', generatedShort)}
  <div class="page-inner">

    ${sectionHeader('Task Highlights', `${overdueList.length} overdue · ${atRiskList.length} at risk · ${recentDone.length} recently completed`)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px;overflow:hidden;width:100%">

      <!-- Overdue -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;
                    background:#FEF2F2;border-radius:8px;margin-bottom:8px;border:1px solid #FECACA">
          <span style="font-size:11px;font-weight:700;color:#991B1B">⚠ Overdue</span>
          <span style="font-size:11px;font-weight:700;font-family:monospace;color:#EF4444">${overdueList.length}</span>
        </div>
        ${taskRows(overdueList, 'overdue')}
      </div>

      <!-- At risk -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;
                    background:#FFFBEB;border-radius:8px;margin-bottom:8px;border:1px solid #FDE68A">
          <span style="font-size:11px;font-weight:700;color:#92400E">🕐 At Risk (≤5d)</span>
          <span style="font-size:11px;font-weight:700;font-family:monospace;color:#F59E0B">${atRiskList.length}</span>
        </div>
        ${taskRows(atRiskList, 'risk')}
      </div>

      <!-- Recently done -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;
                    background:#F0FDF4;border-radius:8px;margin-bottom:8px;border:1px solid #A7F3D0">
          <span style="font-size:11px;font-weight:700;color:#065F46">✓ Completed</span>
          <span style="font-size:11px;font-weight:700;font-family:monospace;color:#10B981">${recentDone.length}</span>
        </div>
        ${taskRows(recentDone, 'done')}
      </div>
    </div>

    ${sectionHeader('Member Performance', `${members.length} team members`)}
    ${memberTable(members)}

  </div>
  ${pageFooter(3, totalPages, title)}
</div>


<!-- ════════════════════════════════════════════════════════════════════════
     PAGE 4 — RISK ASSESSMENT + RECOMMENDATIONS
════════════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader('Risk Assessment & Recommendations', generatedShort)}
  <div class="page-inner">

    ${sectionHeader('Risk Assessment', `${risks.length} risk${risks.length !== 1 ? 's' : ''} identified`)}
    <div style="margin-bottom:28px">
      ${riskBlocks || '<div style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:10px;padding:14px 16px;color:#065F46;font-size:13px;font-weight:600">✅ No significant risks identified. Project is on track.</div>'}
    </div>

    ${sectionHeader('Action Items', `${recs.length} recommendation${recs.length !== 1 ? 's' : ''}`)}
    ${recItems || '<p style="color:#9CA3AF;font-size:12px">No recommendations at this time.</p>'}

  </div>
  ${pageFooter(4, totalPages, title)}
</div>


<!-- ════════════════════════════════════════════════════════════════════════
     PAGE 5 — PER-PROJECT BREAKDOWN (company-wide only)
════════════════════════════════════════════════════════════════════════ -->
${hasProjects ? `
<div class="page">
  ${pageHeader('Per-Project Breakdown', `${projects.length} projects · ${generatedShort}`)}
  <div class="page-inner">
    ${sectionHeader('Project Performance', `${projects.length} projects analysed`)}
    ${projectCards(projects)}
  </div>
  ${pageFooter(5, totalPages, title)}
</div>` : ''}

</body>
</html>`;
}
