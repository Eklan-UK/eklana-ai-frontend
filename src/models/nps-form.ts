import { Schema, model, models, Document, Types } from 'mongoose';
import '@/models/user';

/** Singleton key — only one NPS form config document exists. */
export const NPS_FORM_SINGLETON_KEY = 'default';

export interface INpsForm extends Document {
  key: string;
  name: string;
  url: string;
  isActive: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INpsForm>(
  {
    key: { type: String, required: true, unique: true, default: NPS_FORM_SINGLETON_KEY },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'nps_forms' },
);

const NpsFormModel = models.NpsForm || model<INpsForm>('NpsForm', schema);

export default NpsFormModel;
