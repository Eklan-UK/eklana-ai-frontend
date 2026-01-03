"use client";

import React, { useCallback, useState, useRef, useId } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  disabled?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileSelect,
  onRemove,
  acceptedTypes = ".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.md",
  maxSize = 10,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        alert(`File size exceeds ${maxSize}MB limit`);
        return;
      }

      // Check file type
      const extension = file.name.split(".").pop()?.toLowerCase();
      const acceptedExtensions = acceptedTypes
        .split(",")
        .map((t) => t.replace(".", ""));

      if (extension && !acceptedExtensions.includes(extension)) {
        alert(`File type not supported. Accepted types: ${acceptedTypes}`);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [maxSize, acceptedTypes, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset the input so the same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRemove = () => {
    setSelectedFile(null);
    if (onRemove) onRemove();
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
						border-2 border-dashed rounded-lg p-8 text-center transition-colors relative
						${isDragging ? "border-[#418b43] bg-emerald-50" : "border-gray-300"}
						${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:border-[#418b43] hover:bg-gray-50"
            }
					`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleFileInput}
            disabled={disabled}
            className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${
              isDragging ? "pointer-events-none" : ""
            }`}
            id={inputId}
            tabIndex={-1}
          />
          <div className="pointer-events-none">
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, Word, Excel, CSV, Text, Markdown (Max{" "}
              {maxSize}MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
              title="Remove file"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
