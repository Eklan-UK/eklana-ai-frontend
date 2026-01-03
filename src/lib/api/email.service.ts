// Email service for notifications
import nodemailer from 'nodemailer';
import config from './config';
import { logger } from './logger';

// Create transporter
const createTransporter = () => {
	// Use environment variables for email configuration
	// Support for SMTP (Gmail, SendGrid, etc.) or service-specific configs
	if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
		return nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: parseInt(process.env.SMTP_PORT || '587'),
			secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASSWORD,
			},
		});
	}

	// Fallback: Use Gmail OAuth or App Password
	if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
		return nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.GMAIL_USER,
				pass: process.env.GMAIL_APP_PASSWORD,
			},
		});
	}

	// Development: Use Ethereal Email for testing
	if (config.NODE_ENV === 'development') {
		logger.warn('Email service: Using Ethereal Email for development. Set SMTP_* env vars for production.');
		// Return a mock transporter for development
		return nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			auth: {
				user: 'ethereal.user@ethereal.email',
				pass: 'ethereal.pass',
			},
		});
	}

	throw new Error('Email configuration not found. Please set SMTP_* environment variables.');
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
		subject: `New Drill Assigned: ${data.drillTitle}`,
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
					.footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>New Drill Assigned!</h1>
					</div>
					<div class="content">
						<p>Hi ${data.studentName},</p>
						<p>You have been assigned a new drill by ${data.assignerName}.</p>
						<div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
							<h3>${data.drillTitle}</h3>
							<p><strong>Type:</strong> ${data.drillType}</p>
							${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate}</p>` : ''}
						</div>
						<a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/practice" class="button">View Drill</a>
						<p style="margin-top: 30px;">Good luck with your practice!</p>
					</div>
					<div class="footer">
						<p>This is an automated notification from Elkan Learning Platform.</p>
					</div>
				</div>
			</body>
			</html>
		`,
		text: `
			Hi ${data.studentName},
			
			You have been assigned a new drill by ${data.assignerName}.
			
			Drill: ${data.drillTitle}
			Type: ${data.drillType}
			${data.dueDate ? `Due Date: ${data.dueDate}` : ''}
			
			Visit your dashboard to view and complete the drill.
			
			Good luck with your practice!
		`,
	}),

	emailVerification: (data: { name: string; verificationLink: string }) => ({
		subject: 'Verify Your Email Address',
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
			from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@elkan.com',
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
		};

		const info = await getTransporter().sendMail(mailOptions);
		logger.info('Email sent successfully', {
			to: options.to,
			messageId: info.messageId,
		});
	} catch (error: any) {
		logger.error('Error sending email', {
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
		logger.error('Error sending drill assignment notification', {
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
		logger.error('Error sending email verification', {
			error: error.message,
			email: data.email,
		});
		throw error;
	}
};

