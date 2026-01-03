"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: "white",
          color: "#171717",
          border: "1px solid #e5e7eb",
        },
      }}
    />
  );
}

