"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { profileService } from "@/services/profile.service";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function CloseAccountDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await profileService.deleteAccount();
      toast.success(t("accountClosed"));
      router.push("/auth/login");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("closeAccountFailed")));
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="close-account-title"
        className="bg-card rounded-t-[32px] w-full max-w-md mx-auto px-4 pt-5 pb-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="close-account-title"
          className="text-base font-bold text-foreground mb-2"
        >
          {t("closeAccountTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("closeAccountBody")}
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full py-4 bg-accent-red text-white rounded-full font-medium mb-3 disabled:opacity-50 transition-opacity"
        >
          {isDeleting ? t("closingAccountEllipsis") : t("closeAccountConfirm")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-4 border border-border rounded-full text-foreground font-medium"
        >
          {t("closeAccountCancel")}
        </button>
      </div>
    </div>
  );
}
