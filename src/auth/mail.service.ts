import { resolve4 } from 'node:dns/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;

/** Nodemailer's defaults (2 min connect / 30s greeting) make a blocked or flaky
 *  SMTP path hang for minutes before failing — fail fast instead. */
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;

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

    // Some hosts (Render included) report IPv6 as available but have no
    // outbound IPv6 route, so nodemailer's own dual-stack resolution picks
    // smtp.gmail.com's AAAA record and the connection dies with ENETUNREACH.
    // Resolve the A record ourselves and connect to that literal IPv4
    // address; `tls.servername` keeps SNI/cert validation against the real
    // hostname.
    let host: string = SMTP_HOST;
    try {
      const addresses = await resolve4(SMTP_HOST);
      if (addresses.length > 0) {
        host = addresses[0];
      }
    } catch (error) {
      this.logger.warn(
        `Could not resolve an IPv4 address for ${SMTP_HOST}, falling back to hostname resolution: ${(error as Error).message}`,
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: SMTP_PORT,
      secure: true,
      auth: { user, pass },
      tls: { servername: SMTP_HOST },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
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
