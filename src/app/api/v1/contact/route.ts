import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/api/email.service';
import { logger } from '@/lib/api/logger';
import { connectToDatabase } from '@/lib/api/db';
import { ContactMessage } from '@/models/contact-message';

const bodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('A valid email is required'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required').max(500, 'Message must be 500 characters or fewer'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const json = await req.json();
    const data = bodySchema.parse(json);

    const to = process.env.CONTACT_EMAIL || process.env.BOOK_CALL_EMAIL || 'aa@eklan.ai';

    const subject = `[Contact] ${data.subject} — from ${data.name}`;
    const text = `From: ${data.name} <${data.email}>\nSubject: ${data.subject}\n\n${data.message}`;

    await sendEmail({
      to,
      subject,
      html: `<p><strong>From:</strong> ${data.name} (${data.email})</p><p><strong>Subject:</strong> ${data.subject}</p><hr/><p>${data.message.replace(/\n/g, '<br/>')}</p>`,
      text,
    });

    await connectToDatabase();
    await ContactMessage.create({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
    });

    logger.info('Contact message received', { from: data.email, subject: data.subject });

    return NextResponse.json(
      { code: 'Success', message: "Your message has been sent. We'll get back to you soon." },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'ValidationError', message: 'Invalid request body', errors: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error handling contact message', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { code: 'ServerError', message: 'Failed to send your message. Please try again later.' },
      { status: 500 }
    );
  }
}
