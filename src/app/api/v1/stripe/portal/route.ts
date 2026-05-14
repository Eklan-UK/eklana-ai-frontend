// POST /api/v1/stripe/portal
// Creates a Stripe Billing Portal session so the user can manage their subscription.
// Returns { url } — the client redirects the browser to this URL.
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import User from '@/models/user';
import config from '@/lib/api/config';
import { logger } from '@/lib/api/logger';

function getStripe(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
  });
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    if (!config.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { code: 'ConfigError', message: 'Payment service is not configured.' },
        { status: 500 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(context.userId)
      .select('stripeCustomerId')
      .lean()
      .exec();

    if (!user) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'User not found.' },
        { status: 404 }
      );
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        {
          code: 'BadRequest',
          message: 'No billing account found. Please subscribe first.',
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/account/settings/subscriptions`,
    });

    logger.info('Stripe Billing Portal session created', {
      userId: String((user as any)._id),
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (error: any) {
    logger.error('Error creating Stripe Billing Portal session', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        code: 'ServerError',
        message: 'Could not open billing portal. Please try again.',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);
