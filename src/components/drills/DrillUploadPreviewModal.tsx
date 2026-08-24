"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import {
  DrillContentPreviewBody,
  type DrillContentPreviewResult,
} from "@/components/drills/DrillContentPreviewBody";

interface DrillUploadPreviewModalProps {
  results: DrillContentPreviewResult[];
  onUpload: () => void;
  onCancel: () => void;
  uploading: boolean;
}

export const DrillUploadPreviewModal: React.FC<DrillUploadPreviewModalProps> = ({
  results,
  onUpload,
  onCancel,
  uploading,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Review drill</h3>
        <p className="text-sm text-gray-500 mb-6">
          This is how the content will appear for the student
        </p>

        <DrillContentPreviewBody
          results={results}
          className="max-h-[60vh] overflow-y-auto mb-6 space-y-6"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading}
            className="py-3 px-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
