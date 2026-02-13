/**
 * Email Service
 * Premium email templates with Arcellite brand identity.
 * Gradient headers, info blocks, badge labels, rich footer.
 * No SVGs (Gmail strips them). Pure table layout with inline styles.
 */

import nodemailer from 'nodemailer';
import fs from 'fs';

// ─── Design Tokens ──────────────────────────────────────────────────

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO_STACK = "'SF Mono', 'Fira Code', 'Consolas', 'Courier New', monospace";

// ─── Shared Email Layout ────────────────────────────────────────────

/** Wrap email content in branded shell with gradient header */
function emailLayout(options: {
  headerTitle: string;
  headerSubtitle: string;
  bodyHtml: string;
  preheader?: string;
}): string {
  const { headerTitle, headerSubtitle, bodyHtml, preheader } = options;
  const preheaderText = preheader || 'Arcellite \u2014 Your Personal Cloud';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Arcellite</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #F0F0F3;">

  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheaderText}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F0F0F3;">
    <tr>
      <td align="center" valign="top" style="padding: 0;">

        <!-- Top Accent Bar -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #4F46E5 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="height: 40px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
        </table>

        <!-- Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" class="email-container" style="margin: 0 auto;">
          <tr>
            <td align="center" style="padding: 0 20px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <table cellpadding="0" cellspacing="0" style="width: 32px; height: 32px; background-color: #4F46E5; border-radius: 8px;">
                      <tr><td align="center" valign="middle" style="color: #ffffff; font-size: 16px; font-weight: 800; font-family: ${FONT_STACK}; line-height: 32px;">A</td></tr>
                    </table>
                  </td>
                  <td valign="middle">
                    <span style="font-size: 21px; font-weight: 700; color: #1A1A2E; letter-spacing: -0.5px; font-family: ${FONT_STACK};">Arcellite<span style="color: #5D5FEF;">.</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" class="email-container" style="margin: 0 auto;">
          <tr>
            <td style="padding: 0 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius: 16px; overflow: hidden; background-color: #ffffff; border: 1px solid #E2E2EA;">

                <!-- Gradient Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #4F46E5 0%, #6D5BF7 100%); padding: 40px 40px 36px;" class="mobile-padding">
                    <h1 style="margin: 0 0 8px; font-family: ${FONT_STACK}; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; line-height: 1.3;">
                      ${headerTitle}
                    </h1>
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 15px; color: rgba(255,255,255,0.85); line-height: 1.5;">
                      ${headerSubtitle}
                    </p>
                  </td>
                </tr>

                ${bodyHtml}

              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="height: 28px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" class="email-container" style="margin: 0 auto;">
          <tr>
            <td align="center" style="padding: 0 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 0 20px;">
                    <div style="height: 1px; background-color: #DDDDE3; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 12px;">
                          <a href="https://arcellite.com" style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 500; color: #8787A0; text-decoration: none;">Website</a>
                        </td>
                        <td style="color: #DDDDE3; font-size: 12px;">|</td>
                        <td style="padding: 0 12px;">
                          <a href="https://github.com/arcellite/arcellite" style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 500; color: #8787A0; text-decoration: none;">GitHub</a>
                        </td>
                        <td style="color: #DDDDE3; font-size: 12px;">|</td>
                        <td style="padding: 0 12px;">
                          <a href="mailto:support@arcellite.com" style="font-family: ${FONT_STACK}; font-size: 12px; font-weight: 500; color: #8787A0; text-decoration: none;">Support</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 0 4px;">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 12px; color: #B0B0C0; font-weight: 500;">
                      Arcellite<span style="color: #5D5FEF;">.</span> &middot; Personal Cloud
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 0 8px;">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 11px; color: #C8C8D4;">
                      You&#39;re receiving this because you have an Arcellite account
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="height: 40px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Transporters ───────────────────────────────────────────────────

function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '465');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
}

function createAITransporter() {
  const port = parseInt(process.env.AI_SMTP_PORT || process.env.SMTP_PORT || '465');
  return nodemailer.createTransport({
    host: process.env.AI_SMTP_HOST || process.env.SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.AI_SMTP_USER || process.env.SMTP_USER,
      pass: process.env.AI_SMTP_PASSWORD || process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
}

/** Retry helper for sending emails */
async function sendWithRetry(
  transporterFn: () => ReturnType<typeof nodemailer.createTransport>,
  mailOptions: any,
  label: string = 'Email',
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transporter = transporterFn();
    try {
      await transporter.sendMail(mailOptions);
      transporter.close();
      return;
    } catch (err: any) {
      transporter.close();
      console.warn(`[${label}] Send attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ─── Verification Email ─────────────────────────────────────────────

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.warn('[Email] SMTP not configured, skipping email send');
    return;
  }

  const digits = code.split('');

  const digitStyle = `
    display: inline-block;
    width: 44px; height: 52px; line-height: 52px;
    text-align: center;
    font-size: 24px; font-weight: 700;
    color: #1A1A2E;
    background-color: #F7F7FB;
    border: 1px solid #E2E2EA;
    border-radius: 10px;
    margin: 0 3px;
    font-family: ${MONO_STACK};
  `.trim().replace(/\n\s+/g, ' ');

  const bodyHtml = `
                <tr>
                  <td style="padding: 36px 40px 0;" class="mobile-padding">
                    <p style="margin: 0 0 20px; font-family: ${FONT_STACK}; font-size: 15px; color: #3C3C50; line-height: 1.65;">
                      Enter this code to verify your email address and complete your account setup.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding: 8px 40px 28px;" class="mobile-padding">
                    ${digits.map(d => `<span style="${digitStyle}">${d}</span>`).join('')}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 40px;" class="mobile-padding">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7FB; border-radius: 10px;">
                      <tr>
                        <td align="center" style="padding: 14px 20px;">
                          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0;">
                            This code expires in <strong style="color: #3C3C50;">15 minutes</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 24px 40px 0;" class="mobile-padding">
                    <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 20px 40px 36px;" class="mobile-padding">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; line-height: 1.6;">
                      If you didn&#39;t request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Arcellite <noreply@arcellite.com>',
    to: email,
    subject: 'Your verification code',
    html: emailLayout({
      headerTitle: 'Verification code',
      headerSubtitle: 'Verify your email to get started',
      bodyHtml,
      preheader: `Your Arcellite verification code: ${code}`,
    }),
  };

  await sendWithRetry(createTransporter, mailOptions, 'Email');
}

// ─── AI File Delivery Email ─────────────────────────────────────────

/** Get file type label and color */
function getFileType(fileName: string): { label: string; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return { label: 'PDF', color: '#DC2626' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', color: '#2563EB' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'XLS', color: '#16A34A' };
  if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', color: '#EA580C' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { label: 'IMG', color: '#7C3AED' };
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return { label: 'VID', color: '#DB2777' };
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return { label: 'MP3', color: '#0891B2' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { label: 'ZIP', color: '#CA8A04' };
  if (['epub', 'mobi'].includes(ext)) return { label: 'EPUB', color: '#5D5FEF' };
  if (['txt', 'md', 'rtf'].includes(ext)) return { label: 'TXT', color: '#6B7280' };
  if (['py', 'js', 'ts', 'java', 'cpp', 'go', 'rs'].includes(ext)) return { label: 'CODE', color: '#059669' };
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', color: '#6B7280' };
}

export async function sendFileEmail(
  toEmail: string,
  filePath: string,
  fileName: string,
  message?: string
): Promise<void> {
  const smtpUser = process.env.AI_SMTP_USER || process.env.SMTP_USER;
  if (!smtpUser) {
    throw new Error('AI email not configured. Set AI_SMTP_* environment variables.');
  }

  const fromAddress = process.env.AI_SMTP_FROM || 'Arcellite AI <assistant@arcellite.com>';
  const fileType = getFileType(fileName);

  // Get file size
  let sizeText = '';
  try {
    const stat = fs.statSync(filePath);
    const mb = stat.size / (1024 * 1024);
    sizeText = mb < 1 ? `${(stat.size / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  } catch {}

  const bodyHtml = `
                <tr>
                  <td style="padding: 36px 40px 0;" class="mobile-padding">
                    <p style="margin: 0 0 20px; font-family: ${FONT_STACK}; font-size: 15px; color: #3C3C50; line-height: 1.65;">
                      ${message || 'Here\'s the file you requested from your Arcellite cloud storage.'}
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 4px 0 20px;">
                          <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7FB; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="padding-bottom: 14px;">
                                <span style="display: inline-block; background-color: #EEE9FF; color: ${fileType.color}; font-family: ${MONO_STACK}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 6px;">${fileType.label}</span>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                  <tr>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; font-weight: 500; width: 80px;">File</td>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #1A1A2E; font-weight: 600; word-break: break-word;">${fileName}</td>
                                  </tr>
                                  ${sizeText ? `<tr>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; font-weight: 500; width: 80px;">Size</td>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #1A1A2E; font-weight: 600;">${sizeText}</td>
                                  </tr>` : ''}
                                  <tr>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; font-weight: 500; width: 80px;">Status</td>
                                    <td style="padding: 4px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #1A1A2E; font-weight: 600;">Attached</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 24px 40px 0;" class="mobile-padding">
                    <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 20px 40px 36px;" class="mobile-padding">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; line-height: 1.5;">
                      Sent from your Arcellite personal cloud
                    </p>
                  </td>
                </tr>`;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'File delivery',
    html: emailLayout({
      headerTitle: 'File delivery',
      headerSubtitle: 'A file from your personal cloud',
      bodyHtml,
      preheader: `File delivery: ${fileName}`,
    }),
    attachments: [{
      filename: fileName,
      path: filePath,
    }],
  };

  await sendWithRetry(createAITransporter, mailOptions, 'AI Email');
}

// ─── Support Emails ─────────────────────────────────────────────────

/** Map subject keys to human labels */
const SUBJECT_LABELS: Record<string, string> = {
  'file-management': 'File Management',
  'storage-devices': 'Storage & External Devices',
  'ai-assistant': 'AI Assistant',
  'database': 'Database Management',
  'account-security': 'Account & Security',
  'setup-installation': 'Setup & Installation',
  'performance': 'Performance & Speed',
  'feature-request': 'Feature Request',
  'bug-report': 'Bug Report',
  'other': 'Other',
};

/** Send the support request to the support inbox */
export async function sendSupportEmail(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  if (!smtpUser) {
    throw new Error('SMTP not configured. Set SMTP_* environment variables.');
  }

  const topicLabel = SUBJECT_LABELS[data.subject] || data.subject;
  const supportAddress = 'support@arcellite.com';

  const bodyHtml = `
                <tr>
                  <td style="padding: 36px 40px 0;" class="mobile-padding">
                    <p style="margin: 0 0 20px; font-family: ${FONT_STACK}; font-size: 15px; color: #3C3C50; line-height: 1.65;">
                      A user has submitted a support request from the Arcellite dashboard.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 4px 0 20px;">
                          <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7FB; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="padding-bottom: 14px;">
                                <span style="display: inline-block; background-color: #EEE9FF; color: #4F46E5; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 6px;">Request Details</span>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; font-weight: 500; width: 80px;">From</td>
                                    <td style="padding: 6px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #1A1A2E; font-weight: 600;">${data.name} &lt;${data.email}&gt;</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; font-weight: 500; width: 80px;">Topic</td>
                                    <td style="padding: 6px 0; font-family: ${FONT_STACK}; font-size: 13px; color: #4F46E5; font-weight: 600;">${topicLabel}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 20px 0;">
                          <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 6px; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; color: #8787A0; text-transform: uppercase; letter-spacing: 0.8px;">Message</p>
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 15px; color: #3C3C50; line-height: 1.65; white-space: pre-wrap;">${data.message}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 24px 40px 0;" class="mobile-padding">
                    <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 20px 40px 36px;" class="mobile-padding">
                    <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 13px; color: #8787A0; line-height: 1.5;">
                      Reply directly to this email to respond to <strong style="color: #3C3C50;">${data.email}</strong>
                    </p>
                  </td>
                </tr>`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Arcellite <noreply@arcellite.com>',
    to: supportAddress,
    replyTo: data.email,
    subject: `[Support] ${topicLabel} \u2014 from ${data.name}`,
    html: emailLayout({
      headerTitle: 'Support request',
      headerSubtitle: 'A new message from the dashboard',
      bodyHtml,
      preheader: `Support request from ${data.name}: ${topicLabel}`,
    }),
  };

  await sendWithRetry(createTransporter, mailOptions, 'Support Email');
}

/** Send the AI-generated acknowledgment back to the user */
export async function sendSupportAcknowledgment(data: {
  toEmail: string;
  toName: string;
  subject: string;
  aiReply: string;
}): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  if (!smtpUser) {
    throw new Error('SMTP not configured.');
  }

  const topicLabel = SUBJECT_LABELS[data.subject] || data.subject;

  // Convert newlines in AI reply to <br> for HTML
  const formattedReply = data.aiReply
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const bodyHtml = `
                <tr>
                  <td style="padding: 36px 40px 0;" class="mobile-padding">
                    <p style="margin: 0 0 20px; font-family: ${FONT_STACK}; font-size: 15px; color: #3C3C50; line-height: 1.65;">
                      Hi ${data.toName}, thanks for reaching out. Here&#39;s an initial response regarding your <strong style="color: #1A1A2E;">${topicLabel.toLowerCase()}</strong> inquiry.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 4px 0 20px;">
                          <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7FB; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="padding-bottom: 12px;">
                                <span style="display: inline-block; background-color: #EEE9FF; color: #4F46E5; font-family: ${FONT_STACK}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 6px;">AI Response</span>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; color: #3C3C50; line-height: 1.7;">
                                  ${formattedReply}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 24px 40px 0;" class="mobile-padding">
                    <div style="height: 1px; background-color: #ECECF1; font-size: 0; line-height: 0;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 20px 40px 36px;" class="mobile-padding">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7FB; border-radius: 10px;">
                      <tr>
                        <td style="padding: 14px 20px;">
                          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 12px; color: #8787A0; line-height: 1.5;">
                            This is an automated response from our AI assistant. A member of our team will follow up if needed. You can reply directly to this email for further assistance.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Arcellite <noreply@arcellite.com>',
    to: data.toEmail,
    replyTo: 'support@arcellite.com',
    subject: `Re: ${topicLabel} \u2014 Arcellite Support`,
    html: emailLayout({
      headerTitle: 'We received your message',
      headerSubtitle: 'Thanks for reaching out to us',
      bodyHtml,
      preheader: `We received your support request: ${topicLabel}`,
    }),
  };

  await sendWithRetry(createTransporter, mailOptions, 'Support Ack');
}
