import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(res: Response, message: string, statusCode = 400, code?: string) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
