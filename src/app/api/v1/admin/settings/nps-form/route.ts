// GET, PUT /api/v1/admin/settings/nps-form — singleton NPS form config
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { withErrorHandler } from '@/lib/api/error-handler';
import { connectToDatabase } from '@/lib/api/db';
import { parseRequestBody } from '@/lib/api/request-parser';
import { apiResponse } from '@/lib/api/response';
import NpsForm, { NPS_FORM_SINGLETON_KEY } from '@/models/nps-form';
import { isValidGoogleFormsUrl } from '@/lib/nps-form-url';

const putSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
  isActive: z.boolean().optional(),
});

async function getHandler(
  _req: NextRequest,
  _ctx: { userId: Types.ObjectId; userRole: string },
) {
  void _req;
  void _ctx;
  await connectToDatabase();
  const doc = await NpsForm.findOne({ key: NPS_FORM_SINGLETON_KEY }).lean();
  if (!doc) {
    return apiResponse.success(null);
  }
  return apiResponse.success({
    name: doc.name,
    url: doc.url,
    isActive: doc.isActive,
    updatedAt: doc.updatedAt.toISOString(),
  });
}

async function putHandler(
  req: NextRequest,
  ctx: { userId: Types.ObjectId; userRole: string },
) {
  await connectToDatabase();
  const raw = await parseRequestBody(req);
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return apiResponse.error('ValidationError', parsed.error.message, 400);
  }

  const url = parsed.data.url.trim();
  if (!isValidGoogleFormsUrl(url)) {
    return apiResponse.error(
      'ValidationError',
      'URL must be a valid Google Forms link (docs.google.com/forms or forms.gle)',
      400,
    );
  }

  const doc = await NpsForm.findOneAndUpdate(
    { key: NPS_FORM_SINGLETON_KEY },
    {
      $set: {
        name: parsed.data.name.trim(),
        url,
        isActive: parsed.data.isActive ?? true,
        updatedBy: ctx.userId,
      },
      $setOnInsert: { key: NPS_FORM_SINGLETON_KEY },
    },
    { upsert: true, new: true },
  ).lean();

  return apiResponse.success({
    name: doc!.name,
    url: doc!.url,
    isActive: doc!.isActive,
    updatedAt: doc!.updatedAt.toISOString(),
  });
}

export const GET = withRole(['admin'], withErrorHandler(getHandler));
export const PUT = withRole(['admin'], withErrorHandler(putHandler));
