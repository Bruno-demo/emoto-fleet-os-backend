import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress = this.configService.get<string>(
      'SMTP_FROM',
      'eMoto Fleet OS <no-reply@emotofleet.com>',
    );

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass,
          },
        });
        this.logger.log(
          `SMTP Mailer initialized successfully. Host: ${host}:${port}`,
        );
      } catch (error: unknown) {
        this.logger.error(
          `Failed to initialize SMTP transport: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      this.logger.warn(
        'SMTP environment variables are not fully configured. Falling back to console logging/Dev Mode mock mailer.',
      );
    }
  }

  /**
   * General purpose email sending method
   */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    const host = this.configService.get<string>('SMTP_HOST');
    const pass = this.configService.get<string>('SMTP_PASS');

    // If using Resend, prefer their HTTPS REST API to completely bypass Railway's outbound SMTP port blockades!
    if (
      (host === 'smtp.resend.com' || (!host && pass?.startsWith('re_'))) &&
      pass
    ) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pass}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [to],
            subject,
            html,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { id?: string };
          this.logger.log(
            `Email sent successfully to ${to} via Resend HTTPS REST API. MessageId: ${data.id ?? 'unknown'}`,
          );
          return true;
        } else {
          const errorData = await response.text();
          this.logger.error(
            `Resend HTTPS REST API returned error status ${response.status}: ${errorData}`,
          );
        }
      } catch (error: unknown) {
        this.logger.error(
          `Failed to send email to ${to} via Resend HTTPS REST API: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    if (!this.transporter) {
      this.logger.warn(`[Dev Mode Mock Mail] Would send email to: ${to}`);
      this.logger.warn(`[Dev Mode Mock Mail] Subject: ${subject}`);
      this.logger.warn(
        `[Dev Mode Mock Mail] HTML body length: ${html.length} chars`,
      );
      return true;
    }

    try {
      const info = (await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      })) as { messageId?: string };
      this.logger.log(
        `Email sent successfully to ${to}. MessageId: ${info.messageId ?? 'unknown'}`,
      );
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Sends a beautiful HTML OTP verification email to the user
   */
  async sendOtpEmail(
    email: string,
    otp: string,
    reason: string,
  ): Promise<boolean> {
    const isLogin = reason === 'login';
    const isRegister = reason === 'register';

    let actionText = 'verify your identity';
    let welcomeText = 'Here is your one-time verification code.';
    let subject = 'eMoto Verification Code';

    if (isLogin) {
      actionText = 'authenticate and sign into the Fleet OS console';
      welcomeText = 'A login request was made for your eMoto Fleet OS account.';
      subject = `eMoto Login Code: ${otp}`;
    } else if (isRegister) {
      actionText = 'complete your eMoto Fleet OS registration';
      welcomeText =
        'Welcome to eMoto Fleet OS! Please verify your email address to get started.';
      subject = `Verify your eMoto Email: ${otp}`;
    } else {
      actionText = 'reset your eMoto account password';
      welcomeText =
        'A password reset request was made for your eMoto Fleet OS account.';
      subject = `eMoto Password Reset Code: ${otp}`;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #0d0d0e;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0d0d0e;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #161617;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 40px;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      color: #00c853;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0;
    }
    .subtitle {
      font-size: 11px;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      margin-top: 5px;
    }
    .content {
      font-size: 15px;
      line-height: 1.6;
      color: #d4d4d8;
      margin-bottom: 30px;
    }
    .highlight {
      color: #ffffff;
      font-weight: 600;
    }
    .otp-card {
      background: linear-gradient(135deg, rgba(0, 200, 83, 0.05) 0%, rgba(0, 200, 83, 0.02) 100%);
      border: 1px solid rgba(0, 200, 83, 0.2);
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    .otp-code {
      font-family: "Courier New", Courier, monospace;
      font-size: 42px;
      font-weight: 800;
      color: #00c853;
      letter-spacing: 0.25em;
      margin: 0;
      padding-left: 0.25em; /* centers letter-spacing */
    }
    .otp-label {
      font-size: 11px;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-top: 10px;
      font-weight: 600;
    }
    .footer {
      border-top: 1px solid #27272a;
      padding-top: 20px;
      font-size: 12px;
      color: #71717a;
      text-align: center;
      line-height: 1.5;
    }
    .footer-warning {
      color: #a1a1aa;
      font-size: 11px;
      margin-top: 15px;
      background-color: rgba(239, 68, 68, 0.04);
      border: 1px solid rgba(239, 68, 68, 0.1);
      border-radius: 10px;
      padding: 12px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="logo-text">eMoto</h1>
        <div class="subtitle">Fleet Operations OS</div>
      </div>
      
      <div class="content">
        <p>Hello,</p>
        <p>${welcomeText}</p>
        <p>Please enter the code below to <span class="highlight">${actionText}</span>. This code is valid for the next <span class="highlight">5 minutes</span> and can only be used once.</p>
        
        <div class="otp-card">
          <div class="otp-code">${otp}</div>
          <div class="otp-label">One-Time Verification Code</div>
        </div>
        
        <p>If you did not request this code, you can safely ignore this email. Your password or account access remains secure.</p>
      </div>
      
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} eMoto. All rights reserved.</p>
        <p>This is an automated operational notification. Please do not reply directly to this email.</p>
        
        <div class="footer-warning">
          <strong>Security Notice:</strong> eMoto staff will never ask you for your verification code or password over email, phone, or chat. Never share this code with anyone.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail(email, subject, htmlContent);
  }

  /**
   * Sends a styled operational/billing notification email
   */
  async sendNotificationEmail(
    email: string,
    subject: string,
    title: string,
    message: string,
  ): Promise<boolean> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #0d0d0e;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0d0d0e;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #161617;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 40px;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 800;
      color: #00c853;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0;
    }
    .subtitle {
      font-size: 11px;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      margin-top: 5px;
    }
    .notification-card {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 16px;
      padding: 24px;
      margin: 20px 0;
    }
    .notification-title {
      font-size: 16px;
      font-weight: 700;
      color: #3b82f6;
      margin: 0 0 10px 0;
    }
    .notification-body {
      font-size: 14px;
      line-height: 1.6;
      color: #d4d4d8;
      margin: 0;
    }
    .footer {
      border-top: 1px solid #27272a;
      padding-top: 20px;
      font-size: 12px;
      color: #71717a;
      text-align: center;
      line-height: 1.5;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="logo-text">eMoto</h1>
        <div class="subtitle">Fleet Operations OS</div>
      </div>
      
      <div class="notification-card">
        <h2 class="notification-title">${title}</h2>
        <p class="notification-body">${message}</p>
      </div>
      
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} eMoto. All rights reserved.</p>
        <p>This is an automated operational notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail(email, subject, htmlContent);
  }
}
