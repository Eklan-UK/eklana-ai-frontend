import { Schema, model, models, Document } from 'mongoose';

/** Dedup record for processed Stripe webhook event IDs — skip retries already handled. */
export interface IStripeWebhookEvent extends Document {
  eventId: string;
  type: string;
  processedAt: Date;
}

const schema = new Schema<IStripeWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false, collection: 'stripe_webhook_events' }
);

const StripeWebhookEventModel =
  models.StripeWebhookEvent ||
  model<IStripeWebhookEvent>('StripeWebhookEvent', schema);

export default StripeWebhookEventModel;
