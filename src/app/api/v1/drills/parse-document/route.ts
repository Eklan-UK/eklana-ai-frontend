import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { logger } from "@/lib/api/logger";
import { documentParserService } from "@/services/document-parser.service";

async function handler(
  req: NextRequest,
  context: { userId: any; userRole: string }
): Promise<NextResponse> {
  try {
    // Role already checked by withRole middleware
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "No file provided",
        },
        { status: 400 }
      );
    }

    // Convert FormData file to File/Blob
    // In Next.js, formData.get() returns FormDataEntryValue which is File | string
    let fileToProcess: File | Blob;
    let fileName: string;
    let fileSize: number;

    // Check if it's a string (invalid for file upload)
    if (typeof file === "string") {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "Invalid file format. Expected File object.",
        },
        { status: 400 }
      );
    }

    // Check if it's a File
    if (file instanceof File) {
      fileToProcess = file;
      fileName = file.name || "document";
      fileSize = file.size;
    } else {
      // If it's not a File and not a string, it might be a Blob-like object
      // Type guard: check if it has the Blob properties
      const blobLike = file as any;
      if (
        blobLike &&
        typeof blobLike.size === "number" &&
        typeof blobLike.arrayBuffer === "function"
      ) {
        fileToProcess = blobLike as Blob;
        fileName = blobLike.name || "document";
        fileSize = blobLike.size;
      } else {
        return NextResponse.json(
          {
            code: "ValidationError",
            message: "Invalid file format. Expected File or Blob.",
          },
          { status: 400 }
        );
      }
    }

    // Ensure we have a file name (default to 'document' if missing)
    if (!fileName) {
      fileName = "document";
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      return NextResponse.json(
        {
          code: "ValidationError",
          message: "File size exceeds 10MB limit",
        },
        { status: 400 }
      );
    }

    // Parse document
    const parsed = await documentParserService.parseDocument(fileToProcess);

    logger.info("Document parsed successfully", {
      fileName: fileName,
      fileSize: fileSize,
      detectedType: parsed.type,
      confidence: parsed.confidence,
    });

    return NextResponse.json(
      {
        code: "Success",
        message: "Document parsed successfully",
        data: parsed,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("Error parsing document", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Provide more helpful error messages
    let errorMessage = "Failed to parse document";
    if (
      error.message.includes("pdf-parse") ||
      error.message.includes("mammoth") ||
      error.message.includes("xlsx")
    ) {
      errorMessage =
        "Document parsing library error. Please ensure all required packages are installed.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        code: "ServerError",
        message: errorMessage,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export const POST = withRole(["tutor", "admin"], handler);
