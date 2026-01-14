// Email service for notifications
import nodemailer from "nodemailer";
import config from "./config";
import { logger } from "./logger";

// Create transporter
const createTransporter = () => {
  // Use environment variables for email configuration
  // Support for SMTP (Gmail, SendGrid, etc.) or service-specific configs
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // Fallback: Use Gmail OAuth or App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // Development: Use Ethereal Email for testing
  if (config.NODE_ENV === "development") {
    logger.warn(
      "Email service: Using Ethereal Email for development. Set SMTP_* env vars for production."
    );
    // Return a mock transporter for development
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: "ethereal.user@ethereal.email",
        pass: "ethereal.pass",
      },
    });
  }

  throw new Error(
    "Email configuration not found. Please set SMTP_* environment variables."
  );
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Email templates
export const emailTemplates = {
  drillAssigned: (data: {
    studentName: string;
    drillTitle: string;
    drillType: string;
    dueDate?: string;
    assignerName: string;
  }) => ({
    subject: `📚 New Drill Assigned: ${data.drillTitle}`,
    html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>New Drill Assignment</title>
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
				<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
					<!-- Logo/Brand Header -->
					<div style="text-align: center; margin-bottom: 30px;">
						<img src="${
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
            }/logo2.png" alt="eklan Logo" width="60" height="60" style="border-radius: 12px; margin-bottom: 10px;">
						<div style="font-size: 24px; font-weight: bold; color: #22c55e;">eklan</div>
					</div>
					
					<!-- Main Card -->
					<div style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
						<!-- Green Header -->
						<div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center;">
							<div style="font-size: 48px; margin-bottom: 10px;">📚</div>
							<h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Drill Assigned!</h1>
						</div>
						
						<!-- Content -->
						<div style="padding: 30px;">
							<p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>${
                data.studentName
              }</strong>,</p>
							<p style="margin: 0 0 25px 0; font-size: 16px; color: #4b5563;"><strong>${
                data.assignerName
              }</strong> has assigned you a new practice drill.</p>
							
							<!-- Drill Info Card -->
							<div style="background-color: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 25px 0;">
								<h2 style="margin: 0 0 15px 0; font-size: 20px; color: #166534;">${
                  data.drillTitle
                }</h2>
								<div style="display: flex; flex-wrap: wrap; gap: 15px;">
									<div style="flex: 1; min-width: 120px;">
										<span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Type</span>
										<span style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; text-transform: capitalize;">${
                      data.drillType
                    }</span>
									</div>
									${
                    data.dueDate
                      ? `
									<div style="flex: 1; min-width: 120px;">
										<span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Due Date</span>
										<span style="font-size: 14px; font-weight: 500; color: #1f2937;">${data.dueDate}</span>
									</div>
									`
                      : ""
                  }
								</div>
							</div>
							
							<!-- CTA Button -->
							<div style="text-align: center; margin: 30px 0;">
								<a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                }/account/drills" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.4);">Start Practicing →</a>
							</div>
							
							<p style="margin: 25px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">Good luck with your practice! 🍀</p>
						</div>
					</div>
					
					<!-- Footer -->
					<div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
						<p style="margin: 0;">This is an automated notification from Elkan Ai.</p>
						<p style="margin: 10px 0 0 0;">If you have questions, contact your instructor directly.</p>
					</div>
				</div>
			</body>
			</html>
		`,
    text: `
Hi ${data.studentName},

📚 New Drill Assigned!

${data.assignerName} has assigned you a new practice drill.

Drill: ${data.drillTitle}
Type: ${data.drillType}
${data.dueDate ? `Due Date: ${data.dueDate}` : ""}

Visit your drills page to start practicing:
${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/drills

Good luck with your practice! 🍀

---
This is an automated notification from Eklan Ai.
		`,
  }),

  emailVerification: (data: { name: string; verificationLink: string }) => ({
    subject: "Verify Your Email Address",
    html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
					.content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
					.button { display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>Verify Your Email</h1>
					</div>
					<div class="content">
						<p>Hi ${data.name},</p>
						<p>Please verify your email address by clicking the button below:</p>
						<a href="${data.verificationLink}" class="button">Verify Email</a>
						<p style="margin-top: 30px;">If the button doesn't work, copy and paste this link into your browser:</p>
						<p style="word-break: break-all; color: #22c55e;">${data.verificationLink}</p>
					</div>
				</div>
			</body>
			</html>
		`,
    text: `
			Hi ${data.name},
			
			Please verify your email address by visiting this link:
			${data.verificationLink}
		`,
  }),
};

// Send email function
export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> => {
  try {
    const mailOptions = {
      from:
        process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@elkan.com",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const info = await getTransporter().sendMail(mailOptions);
    logger.info("Email sent successfully", {
      to: options.to,
      messageId: info.messageId,
    });
  } catch (error: any) {
    logger.error("Error sending email", {
      error: error.message,
      to: options.to,
    });
    throw error;
  }
};

// Send drill assignment notification
export const sendDrillAssignmentNotification = async (data: {
  studentEmail: string;
  studentName: string;
  drillTitle: string;
  drillType: string;
  dueDate?: Date;
  assignerName: string;
}): Promise<void> => {
  try {
    const template = emailTemplates.drillAssigned({
      studentName: data.studentName,
      drillTitle: data.drillTitle,
      drillType: data.drillType,
      dueDate: data.dueDate ? data.dueDate.toLocaleDateString() : undefined,
      assignerName: data.assignerName,
    });

    await sendEmail({
      to: data.studentEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error: any) {
    logger.error("Error sending drill assignment notification", {
      error: error.message,
      studentEmail: data.studentEmail,
    });
    // Don't throw - email failure shouldn't break drill assignment
  }
};

// Send email verification
export const sendEmailVerification = async (data: {
  email: string;
  name: string;
  verificationLink: string;
}): Promise<void> => {
  try {
    const template = emailTemplates.emailVerification({
      name: data.name,
      verificationLink: data.verificationLink,
    });

    await sendEmail({
      to: data.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error: any) {
    logger.error("Error sending email verification", {
      error: error.message,
      email: data.email,
    });
    throw error;
  }
};

// Send drill review notification to student
export const sendDrillReviewNotification = async (data: {
  studentEmail: string;
  studentName: string;
  drillTitle: string;
  drillType: string;
  tutorName: string;
  score?: number;
  feedback?: string;
  isAcceptable?: boolean;
  correctCount?: number;
  totalCount?: number;
}): Promise<void> => {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Determine the result message based on drill type
    let resultMessage = "";
    if (data.drillType === "summary") {
      resultMessage = data.isAcceptable
        ? "✅ Your summary was accepted!"
        : "📝 Your tutor has provided feedback on your summary.";
    } else if (
      data.correctCount !== undefined &&
      data.totalCount !== undefined
    ) {
      resultMessage =
        data.correctCount === data.totalCount
          ? `✅ All ${data.totalCount} sentences were correct!`
          : `📊 ${data.correctCount}/${data.totalCount} sentences were correct.`;
    }

    const subject = `📝 Feedback Ready: ${data.drillTitle}`;
    const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Drill Feedback Ready</title>
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
				<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
					<!-- Logo/Brand Header -->
					<div style="text-align: center; margin-bottom: 30px;">
						<img src="${appUrl}/logo2.png" alt="eklan Logo" width="60" height="60" style="border-radius: 12px; margin-bottom: 10px;">
						<div style="font-size: 24px; font-weight: bold; color: #22c55e;">eklan</div>
					</div>
					
					<!-- Main Card -->
					<div style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
						<!-- Header -->
						<div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center;">
							<div style="font-size: 48px; margin-bottom: 10px;">📝</div>
							<h1 style="margin: 0; font-size: 24px; font-weight: 600;">Feedback Ready!</h1>
						</div>
						
						<!-- Content -->
						<div style="padding: 30px;">
							<p style="margin: 0 0 20px 0; font-size: 16px;">Hi <strong>${
                data.studentName
              }</strong>,</p>
							<p style="margin: 0 0 25px 0; font-size: 16px; color: #4b5563;">Your tutor <strong>${
                data.tutorName
              }</strong> has reviewed your drill submission.</p>
							
							<!-- Drill Info Card -->
							<div style="background-color: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 25px 0;">
								<h2 style="margin: 0 0 15px 0; font-size: 20px; color: #1e40af;">${
                  data.drillTitle
                }</h2>
								<div style="display: flex; flex-wrap: wrap; gap: 15px;">
									<div style="flex: 1; min-width: 120px;">
										<span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Type</span>
										<span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; text-transform: capitalize;">${
                      data.drillType
                    }</span>
									</div>
									${
                    data.score !== undefined
                      ? `
									<div style="flex: 1; min-width: 120px;">
										<span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Score</span>
										<span style="font-size: 18px; font-weight: 600; color: ${
                      data.score >= 70 ? "#16a34a" : "#f59e0b"
                    };">${data.score}%</span>
									</div>
									`
                      : ""
                  }
								</div>
								${
                  resultMessage
                    ? `
								<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bfdbfe;">
									<p style="margin: 0; font-size: 15px; color: #1f2937;">${resultMessage}</p>
								</div>
								`
                    : ""
                }
								${
                  data.feedback
                    ? `
								<div style="margin-top: 15px; padding: 15px; background-color: white; border-radius: 8px; border-left: 4px solid #3b82f6;">
									<p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Tutor's Feedback:</p>
									<p style="margin: 0; font-size: 14px; color: #374151; font-style: italic;">"${data.feedback}"</p>
								</div>
								`
                    : ""
                }
							</div>
							
							<!-- CTA Button -->
							<div style="text-align: center; margin: 30px 0;">
								<a href="${appUrl}/account/drills" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.4);">View Feedback →</a>
							</div>
							
							<p style="margin: 25px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">Keep up the great work! 🌟</p>
						</div>
					</div>
					
					<!-- Footer -->
					<div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
						<p style="margin: 0;">This is an automated notification from Eklan Ai.</p>
						<p style="margin: 10px 0 0 0;">If you have questions, contact your tutor directly.</p>
					</div>
				</div>
			</body>
			</html>
		`;

    const text = `
Hi ${data.studentName},

📝 Feedback Ready!

Your tutor ${data.tutorName} has reviewed your drill submission.

Drill: ${data.drillTitle}
Type: ${data.drillType}
${data.score !== undefined ? `Score: ${data.score}%` : ""}
${resultMessage}
${data.feedback ? `\nTutor's Feedback: "${data.feedback}"` : ""}

Visit your drills page to view the full feedback:
${appUrl}/account/drills

Keep up the great work! 🌟

---
This is an automated notification from Eklan Ai.
		`;

    await sendEmail({
      to: data.studentEmail,
      subject,
      html,
      text,
    });

    logger.info("Drill review notification sent", {
      studentEmail: data.studentEmail,
      drillTitle: data.drillTitle,
    });
  } catch (error: any) {
    logger.error("Error sending drill review notification", {
      error: error.message,
      studentEmail: data.studentEmail,
    });
    // Don't throw - email failure shouldn't break the review submission
  }
};
