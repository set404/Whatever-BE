import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends via Brevo's HTTP API (HTTPS, port 443) rather than SMTP — Render
 * blocks outbound SMTP ports (25/465/587) on free-tier web services, which
 * made a raw SMTP connection hang until connection timeout.
 * If BREVO_API_KEY/BREVO_FROM_EMAIL aren't set (local dev), logs the link
 * instead of sending so the reset flow is still exercisable without real
 * mail credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const fromEmail = this.config.get<string>('BREVO_FROM_EMAIL');
    if (!apiKey || !fromEmail) {
      this.logger.log(
        `BREVO_API_KEY/BREVO_FROM_EMAIL not set — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    try {
      const res = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: fromEmail },
          to: [{ email: to }],
          subject: 'Reset your password',
          htmlContent: `<p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
        }),
      });
      if (!res.ok) {
        throw new Error(`Brevo API responded ${res.status}: ${await res.text()}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email: ${(error as Error).message}`,
      );
      throw new Error('Failed to send password reset email');
    }
  }
}
