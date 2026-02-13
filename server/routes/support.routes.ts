import type { IncomingMessage, ServerResponse } from 'http';

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, error: string, status = 500) {
  sendJson(res, { error }, status);
}

/** Subject labels for building the AI prompt */
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

export function handleSupportRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const path = url.split('?')[0];

  // ── Submit Support Request ─────────────────────────────────────
  if (path === '/api/support/submit' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const { name, email, subject, message } = body;

        if (!name || !email || !subject || !message) {
          sendError(res, 'All fields are required.', 400);
          return;
        }

        // 1. Send the support request to support@arcellite.com
        const { sendSupportEmail, sendSupportAcknowledgment } = await import('../services/email.service.js');
        await sendSupportEmail({ name, email, subject, message });

        // 2. Generate an AI acknowledgment reply (non-blocking — don't fail if AI is down)
        generateAndSendAIReply({ name, email, subject, message, sendSupportAcknowledgment }).catch(() => {
          // AI reply failed silently — the support email was still sent
        });

        sendJson(res, { ok: true, message: 'Support request submitted successfully.' });
      } catch (e: any) {
        sendError(res, e.message || 'Failed to send support request.');
      }
    }).catch((e) => sendError(res, String((e as Error).message)));
    return true;
  }

  return false;
}

/**
 * Use DeepSeek to generate a personalized acknowledgment and send it to the user.
 * This runs asynchronously — the main response to the client is already sent.
 */
async function generateAndSendAIReply(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  sendSupportAcknowledgment: typeof import('../services/email.service.js').sendSupportAcknowledgment;
}): Promise<void> {
  const topicLabel = SUBJECT_LABELS[data.subject] || data.subject;

  try {
    const { getApiKey } = await import('../ai.js');
    const apiKey = getApiKey('DeepSeek');
    if (!apiKey) return; // No API key — skip AI reply

    const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

    const systemPrompt = `You are the Arcellite Support AI. Arcellite is a self-hosted personal cloud platform that provides file management, external storage support, AI assistant, PostgreSQL database management, media casting, and more — all running on the user's own hardware.

Your job: Write a warm, professional, and helpful acknowledgment email to a user who just submitted a support request. 

Guidelines:
- Address the user by their first name
- Acknowledge the specific topic they wrote about
- Provide any immediately helpful tips, suggestions, or troubleshooting steps based on their message
- Be concise but genuinely helpful — not generic filler text
- Mention that a team member will follow up if further assistance is needed
- Do NOT use markdown formatting — write in plain text (no **, ##, etc.)
- Keep it under 150 words
- Be warm and approachable, not corporate
- Do not include any greeting like "Hi [Name]" or sign-off — those are handled by the email template`;

    const userPrompt = `Support request details:
- Name: ${data.name}
- Topic: ${topicLabel}
- Message: ${data.message}

Write the acknowledgment email body.`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      }),
    });

    if (!response.ok) return;

    const result: any = await response.json();
    const aiReply = result.choices?.[0]?.message?.content?.trim();
    if (!aiReply) return;

    // Send the acknowledgment email
    await data.sendSupportAcknowledgment({
      toEmail: data.email,
      toName: data.name,
      subject: data.subject,
      aiReply,
    });
  } catch {
    // AI reply is best-effort — don't throw
  }
}
