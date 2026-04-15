# Email Service Setup

## Environment Variables Required

Add these to your `.env.local` or production environment:

### SMTP Configuration (Recommended for Production)
```env
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Or use Gmail App Password directly
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Email sender address
EMAIL_FROM=noreply@elkan.com
```

### Application URL (for email links)
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this 16-character password in `GMAIL_APP_PASSWORD`

## Other Email Providers

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-access-key
SMTP_PASSWORD=your-aws-secret-key
```

## Development

In development, the email service will log warnings if SMTP is not configured. For testing, you can use:
- Ethereal Email (automatic in dev mode)
- Mailtrap
- Or configure a real SMTP server

## Features Implemented

✅ **Email Verification**: Automatically sent when users sign up (via Better Auth)
✅ **Drill Assignment Notifications**: Sent to students when drills are assigned
✅ **HTML Email Templates**: Professional email templates with styling

## Testing

To test email sending, you can:
1. Assign a drill to a student (triggers notification email)
2. Sign up a new user (triggers verification email)
3. Check your email service logs for delivery status

