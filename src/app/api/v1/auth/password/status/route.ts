// GET /api/v1/auth/password/status
// Check whether the authenticated user has a password set
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/api/db";
import User from "@/models/user";
import { Types } from "mongoose";
import { userHasPassword } from "@/lib/api/password-account";

async function handler(
  _req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const user = await User.findById(context.userId).select("+password").exec();
    if (!user) {
      return NextResponse.json(
        { code: "NotFoundError", message: "User not found" },
        { status: 404 },
      );
    }

    const hasPassword = await userHasPassword(context.userId, user.password);

    return NextResponse.json({ hasPassword }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: "ServerError", message: "Failed to check password status" },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);
