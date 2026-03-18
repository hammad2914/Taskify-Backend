import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.companyId = payload.companyId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, companyId } = socket.data as { userId: string; companyId: string };

    // Join rooms
    socket.join(`company:${companyId}`);
    socket.join(`user:${userId}`);

    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

export function getSocketInstance(): SocketServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToProject(projectId: string, event: string, data: unknown): void {
  io?.to(`project:${projectId}`).emit(event, data);
}

export function emitToCompany(companyId: string, event: string, data: unknown): void {
  io?.to(`company:${companyId}`).emit(event, data);
}
