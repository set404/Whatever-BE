import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends via Resend's HTTP API directly (no SDK — it's one endpoint). If
 * RESEND_API_KEY isn't set (local dev), logs the link instead of sending so
 * the reset flow is still exercisable without a real mail provider.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.log(
        `RESEND_API_KEY not set — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    const from = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Reset your password',
        html: `<p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Failed to send password reset email: ${response.status} ${body}`,
      );
      throw new Error('Failed to send password reset email');
    }
  }
}
