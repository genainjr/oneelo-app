import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit por usuário autenticado (`req.user.sub`), com fallback para IP.
 * Evita falsos positivos quando dezenas de membros compartilham o mesmo Wi-Fi
 * da igreja durante o culto ou chegam via proxy reverso.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req?.user?.sub;
    if (typeof userId === 'string' && userId.trim()) {
      return `user:${userId.trim()}`;
    }
    return super.getTracker(req);
  }
}
