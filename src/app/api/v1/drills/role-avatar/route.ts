// POST /api/v1/drills/role-avatar
// Upload a roleplay AI character avatar image to Cloudinary (admin/tutor)
import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { withErrorHandler } from "@/lib/api/error-handler";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import { logger } from "@/lib/api/logger";
import { randomUUID } from "crypto";

async function handler(
  req: NextRequest,
  context: { userId: string; userRole: string },
): Promise<NextResponse> {
  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json(
      { code: "ValidationError", message: "Avatar file is required" },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { code: "ValidationError", message: "Only image files are allowed" },
      { status: 400 },
    );
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        code: "ValidationError",
        message: "Image size must be less than 5MB",
      },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadToCloudinary(buffer, {
    folder: "eklan/roleplay/avatars",
    publicId: `role_avatar_${context.userId}_${randomUUID()}`,
    resourceType: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  logger.info("Roleplay role avatar uploaded", {
    userId: context.userId,
    url: uploadResult.secureUrl,
  });

  return NextResponse.json(
    {
      code: "Success",
      message: "Avatar uploaded successfully",
      data: { url: uploadResult.secureUrl },
    },
    { status: 200 },
  );
}

export const POST = withRole(
  ["tutor", "admin"],
  withErrorHandler(handler),
);
