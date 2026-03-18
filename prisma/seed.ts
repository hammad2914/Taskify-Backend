import { PrismaClient, CompanyRole, UserStatus, ProjectStatus, Priority, TaskStatus, ProjectRole, InviteStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.activityLog.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invitationToken.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // Create demo company
  const company = await prisma.company.create({
    data: {
      name: 'Acme Corporation',
      hrApiConnected: false,
    },
  });

  console.log(`✅ Created company: ${company.name}`);

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'Alice Johnson',
      email: 'admin@acme.com',
      passwordHash: adminHash,
      department: 'Engineering',
      designation: 'CTO',
      role: CompanyRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Created admin: ${admin.email}`);

  // Create 3 employees
  const empHash = await bcrypt.hash('Employee@123', 12);

  const emp1 = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'Bob Smith',
      email: 'bob@acme.com',
      passwordHash: empHash,
      department: 'Engineering',
      designation: 'Senior Developer',
      role: CompanyRole.MEMBER,
      status: UserStatus.ACTIVE,
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'Carol White',
      email: 'carol@acme.com',
      passwordHash: empHash,
      department: 'Design',
      designation: 'UI/UX Designer',
      role: CompanyRole.MEMBER,
      status: UserStatus.ACTIVE,
    },
  });

  const emp3 = await prisma.user.create({
    data: {
      companyId: company.id,
      fullName: 'David Brown',
      email: 'david@acme.com',
      passwordHash: empHash,
      department: 'Product',
      designation: 'Product Manager',
      role: CompanyRole.MEMBER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Created 3 employees`);

  // Create 2 projects
  const project1 = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Website Redesign',
      description: 'Complete overhaul of the company website with modern design and improved UX',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      createdById: admin.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Mobile App MVP',
      description: 'Build the minimum viable product for the mobile application',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-08-31'),
      createdById: admin.id,
    },
  });

  console.log(`✅ Created 2 projects`);

  // Add members to projects
  await prisma.projectMember.createMany({
    data: [
      { projectId: project1.id, userId: admin.id, role: ProjectRole.PROJECT_ADMIN, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
      { projectId: project1.id, userId: emp1.id, role: ProjectRole.MEMBER, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
      { projectId: project1.id, userId: emp2.id, role: ProjectRole.MEMBER, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
      { projectId: project2.id, userId: admin.id, role: ProjectRole.PROJECT_ADMIN, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
      { projectId: project2.id, userId: emp1.id, role: ProjectRole.MEMBER, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
      { projectId: project2.id, userId: emp3.id, role: ProjectRole.MEMBER, status: InviteStatus.ACCEPTED, joinedAt: new Date() },
    ],
  });

  // Create 5 tasks
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const nextMonth = new Date(now.getTime() + 30 * 86400000);
  const yesterday = new Date(now.getTime() - 86400000);

  await prisma.task.createMany({
    data: [
      {
        projectId: project1.id,
        companyId: company.id,
        title: 'Design new homepage mockup',
        description: 'Create wireframes and high-fidelity mockups for the new homepage',
        assigneeId: emp2.id,
        createdById: admin.id,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        startDate: now,
        deadline: nextWeek,
        timelineAccepted: true,
      },
      {
        projectId: project1.id,
        companyId: company.id,
        title: 'Implement responsive navigation',
        description: 'Build the responsive navigation component using React and TailwindCSS',
        assigneeId: emp1.id,
        createdById: admin.id,
        priority: Priority.MEDIUM,
        status: TaskStatus.ACCEPTED,
        startDate: tomorrow,
        deadline: nextMonth,
        timelineAccepted: true,
      },
      {
        projectId: project1.id,
        companyId: company.id,
        title: 'SEO optimization audit',
        description: 'Audit current SEO performance and implement improvements',
        assigneeId: emp3.id,
        createdById: admin.id,
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        startDate: tomorrow,
        deadline: nextMonth,
        timelineAccepted: false,
      },
      {
        projectId: project2.id,
        companyId: company.id,
        title: 'Set up React Native project',
        description: 'Initialize the React Native project with navigation and state management',
        assigneeId: emp1.id,
        createdById: admin.id,
        priority: Priority.CRITICAL,
        status: TaskStatus.COMPLETED,
        startDate: new Date('2026-02-01'),
        deadline: new Date('2026-02-28'),
        timelineAccepted: true,
        completedAt: new Date('2026-02-25'),
      },
      {
        projectId: project2.id,
        companyId: company.id,
        title: 'User authentication flow',
        description: 'Implement login, registration, and token refresh in the mobile app',
        assigneeId: emp1.id,
        createdById: admin.id,
        priority: Priority.HIGH,
        status: TaskStatus.OVERDUE,
        startDate: new Date('2026-02-15'),
        deadline: yesterday,
        timelineAccepted: true,
      },
    ],
  });

  console.log(`✅ Created 5 tasks`);

  // Create some activity logs
  await prisma.activityLog.createMany({
    data: [
      { companyId: company.id, projectId: project1.id, userId: admin.id, action: 'CREATE', entity: 'Project', entityId: project1.id, metadata: { name: project1.name } },
      { companyId: company.id, projectId: project2.id, userId: admin.id, action: 'CREATE', entity: 'Project', entityId: project2.id, metadata: { name: project2.name } },
      { companyId: company.id, projectId: project1.id, userId: admin.id, action: 'INVITE', entity: 'ProjectMember', entityId: emp1.id, metadata: { email: emp1.email } },
      { companyId: company.id, projectId: project1.id, userId: admin.id, action: 'CREATE', entity: 'Task', entityId: 'task1', metadata: { title: 'Design new homepage mockup' } },
    ],
  });

  console.log(`✅ Created activity logs`);
  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin:    admin@acme.com  / Admin@123456');
  console.log('  Employee: bob@acme.com    / Employee@123');
  console.log('  Employee: carol@acme.com  / Employee@123');
  console.log('  Employee: david@acme.com  / Employee@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
