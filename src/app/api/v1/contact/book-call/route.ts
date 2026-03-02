import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/api/email.service";
import { logger } from "@/lib/api/logger";
import { connectToDatabase } from "@/lib/api/db";
import { DiscoveryCall } from "@/models/discovery-call";

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const json = await req.json();
    const data = bodySchema.parse(json);

    const to = process.env.BOOK_CALL_EMAIL || "aa@eklan.ai";

    const subject = `Book a call request from ${data.name}`;
    const text = `From: ${data.name} <${data.email}>\n\n${data.message}`;

    await sendEmail({
      to,
      subject,
      html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
      text,
    });

    // Save to the database for the Admin Discovery Calls dashboard
    await connectToDatabase();
    await DiscoveryCall.create({
      name: data.name,
      email: data.email,
      message: data.message,
    });

    logger.info("Book call request email sent", {
      from: data.email,
      to,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Your message has been sent. We'll contact you soon.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Invalid request body",
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    logger.error("Error handling book call request", {
      error: error.message,
    });

    return NextResponse.json(
      {
        code: "ServerError",
        message: "Failed to send your message. Please try again later.",
      },
      { status: 500 }
    );
  }
}




