import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

/**
 * Sends via Gmail SMTP (an App Password on a Gmail account — no domain
 * verification needed). If GMAIL_USER/GMAIL_APP_PASSWORD aren't set (local
 * dev), logs the link instead of sending so the reset flow is still
 * exercisable without real mail credentials.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');
    if (!user || !pass) {
      this.logger.log(
        `GMAIL_USER/GMAIL_APP_PASSWORD not set — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: user,
        to,
        subject: 'Reset your password',
        html: `<p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email: ${(error as Error).message}`,
      );
      throw new Error('Failed to send password reset email');
    }
  }
}
