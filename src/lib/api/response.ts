/**
 * Standard API response helpers
 * Follows the envelope format defined in docs/API_DOCS.md
 */

import { NextResponse } from 'next/server';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiPaginated<T>(data: T[], pagination: PaginationMeta) {
  return NextResponse.json({ data, pagination });
}

export function apiError(
  error: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json({ error, message, details }, { status });
}

export function api401(message = 'Token inválido o expirado') {
  return apiError('Unauthorized', message, 401);
}

export function api403(message = 'Sin permisos para este recurso') {
  return apiError('Forbidden', message, 403);
}

export function api404(message = 'Recurso no encontrado') {
  return apiError('Not Found', message, 404);
}

export function api400(message: string, details?: Record<string, unknown>) {
  return apiError('Bad Request', message, 400, details);
}

export function api500(message = 'Error interno del servidor') {
  return apiError('Internal Server Error', message, 500);
}
