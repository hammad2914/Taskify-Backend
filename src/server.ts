import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './socket';
import { env } from './config/env';
import { prisma } from './config/database';
import { markOverdueTasks } from './modules/tasks/tasks.service';

const httpServer = http.createServer(app);
initSocket(httpServer);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    // Cron: mark overdue tasks every 5 minutes
    setInterval(async () => {
      try {
        const count = await markOverdueTasks();
        if (count > 0) console.log(`⏰ Marked ${count} tasks as overdue`);
      } catch (e) {
        console.error('Overdue check failed:', e);
      }
    }, 5 * 60 * 1000);

    // Initial overdue check on startup
    await markOverdueTasks();

    const PORT = parseInt(env.PORT);
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
