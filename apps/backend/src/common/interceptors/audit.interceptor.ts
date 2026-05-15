import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SessionUserDto } from '@car-rental/shared-types';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function deriveEntityInfo(
  method: string,
  url: string,
  body: unknown,
  responseBody: unknown,
): { entityType: string; entityId: string; action: string } {
  // Strip /api/v1/ prefix and query string
  const cleanUrl = url.replace(/^\/api\/v1\//, '').split('?')[0];
  const parts = cleanUrl.split('/');

  // e.g. ["users", "clm123"] or ["users"] or ["bookings", "clm123", "cancel"]
  const entityType = parts[0] ?? 'unknown';
  const urlId = parts[1] ?? '';

  // Try to get id from response body or request body
  const respBody = responseBody as Record<string, unknown> | null;
  const reqBody = body as Record<string, unknown> | null;

  const entityId =
    (respBody?.['id'] as string | undefined) ??
    (respBody?.['data'] as Record<string, unknown> | undefined)?.['id'] as string | undefined ??
    urlId ??
    (reqBody?.['id'] as string | undefined) ??
    'unknown';

  let action: string;
  if (method === 'POST') {
    action = parts.length > 2 ? `${entityType}.${parts[2]}` : `${entityType}.create`;
  } else if (method === 'PATCH' || method === 'PUT') {
    action = `${entityType}.update`;
  } else if (method === 'DELETE') {
    action = `${entityType}.delete`;
  } else {
    action = `${entityType}.${method.toLowerCase()}`;
  }

  return { entityType, entityId: String(entityId), action };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const user = request.user as SessionUserDto | undefined;
    const ip = request.ip ?? request.socket?.remoteAddress;
    const userAgent = request.headers?.['user-agent'];
    const requestBody = request.body as unknown;

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const { entityType, entityId, action } = deriveEntityInfo(
          method,
          request.url,
          requestBody,
          responseBody,
        );

        // Fire-and-forget — don't await, don't block the response
        void this.prisma.auditLog.create({
          data: {
            actorId: user?.id ?? null,
            action,
            entityType,
            entityId,
            after: (responseBody as Record<string, unknown>) ?? null,
            ip: ip ?? null,
            userAgent: userAgent ?? null,
          },
        });
      }),
    );
  }
}
