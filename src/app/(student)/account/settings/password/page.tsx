"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth-store";
import { useUserCurrent } from "@/hooks/useUserCurrent";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-card shadow-[0px_1px_6px_0px_rgba(0,0,0,0.06)] dark:border dark:border-border">
      <div className="px-4 pb-2 pt-4">
        <p className="font-nunito text-[11px] font-extrabold uppercase leading-[16.5px] tracking-[1.1px] text-[#99a1af]">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function LoginDetailField({
  iconSrc,
  iconTone,
  label,
  value,
  last = false,
}: {
  iconSrc: string;
  iconTone: "teal" | "primary";
  label: string;
  value: string;
  last?: boolean;
}) {
  const iconBg =
    iconTone === "teal"
      ? "bg-[#e8f5f0] dark:bg-[rgba(20,108,91,0.22)]"
      : "bg-[#ecffed] dark:bg-primary/20";

  return (
    <div
      className={`px-4 py-3.5 ${
        last ? "" : "border-b border-[#f9fafb] dark:border-border"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <span className="relative block size-[13px] overflow-hidden">
            <Image
              src={iconSrc}
              alt=""
              width={13}
              height={13}
              className="size-full"
              unoptimized
            />
          </span>
        </div>
        <p className="font-nunito text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.275px] text-[#99a1af]">
          {label}
        </p>
      </div>
      <div className="rounded-[10px] bg-[#f9fafb] px-3 py-2.5 dark:bg-muted">
        <p className="truncate font-nunito text-sm font-bold leading-[21px] text-[#101828] dark:text-foreground">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  disabled,
  error,
  last = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
  error?: string;
  last?: boolean;
  autoComplete?: string;
}) {
  return (
    <div
      className={`px-4 py-3.5 ${
        last ? "" : "border-b border-[#f9fafb] dark:border-border"
      }`}
    >
      <p className="font-nunito text-[11px] font-bold uppercase leading-[16.5px] tracking-[0.275px] text-[#99a1af]">
        {label}
      </p>
      <div className="relative mt-1.5">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className={`h-[43px] w-full rounded-[10px] border border-transparent bg-[#f9fafb] py-2.5 pl-3 pr-10 font-nunito text-sm font-bold leading-[21px] text-[#101828] outline-none placeholder:text-[rgba(16,24,40,0.5)] focus:border-primary/40 focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:bg-muted dark:text-foreground ${
            error ? "border-red-400 focus:border-red-400 focus:ring-red-200" : ""
          }`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center"
        >
          <span className="relative block size-4 overflow-hidden">
            <Image
              src={show ? "/icons/profile/eye-off.svg" : "/icons/profile/eye.svg"}
              alt=""
              width={16}
              height={16}
              className="size-full"
              unoptimized
            />
          </span>
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 font-nunito text-xs font-semibold text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const t = useTranslations("settingsPassword");
  const tSettings = useTranslations("settings");
  const { user } = useAuthStore();
  const { data: me } = useUserCurrent();
  const email = me?.user?.email || user?.email || "";
  const phone =
    (typeof me?.user?.phone === "string" && me.user.phone) ||
    (typeof user?.phone === "string" && user.phone) ||
    "";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const next: typeof errors = {};

    if (!currentPassword) {
      next.currentPassword = t("currentRequired");
    }

    if (!newPassword) {
      next.newPassword = t("newRequired");
    } else if (newPassword.length < 8) {
      next.newPassword = t("minLength");
    }

    if (!confirmPassword) {
      next.confirmPassword = t("confirmRequired");
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = t("mismatch");
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      next.newPassword = t("mustDiffer");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success(t("success"));
      router.back();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("failed");
      toast.error(message);
      if (
        message.toLowerCase().includes("current password") ||
        message.toLowerCase().includes("incorrect")
      ) {
        setErrors({ currentPassword: t("incorrect") });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="h-6" />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3 md:max-w-2xl md:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card shadow-[0px_1px_2px_rgba(0,0,0,0.09)] dark:border dark:border-border"
          >
            <span className="relative block size-[18px] overflow-hidden">
              <Image
                src="/icons/profile/back.svg"
                alt=""
                width={18}
                height={18}
                className="size-full"
                unoptimized
              />
            </span>
          </button>
          <h1 className="font-nunito text-xl font-extrabold leading-[30px] tracking-[-0.3px] text-[#101828] dark:text-foreground">
            {tSettings("changePassword")}
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-md space-y-4 px-4 py-2 md:max-w-2xl md:px-8"
      >
        <SectionCard title={t("loginDetails")}>
          <LoginDetailField
            iconSrc="/icons/profile/email.svg"
            iconTone="teal"
            label={t("emailAddress")}
            value={email}
          />
          <LoginDetailField
            iconSrc="/icons/profile/phone.svg"
            iconTone="primary"
            label={t("phoneNumber")}
            value={phone}
            last
          />
        </SectionCard>

        <SectionCard title={t("changePasswordSection")}>
          <PasswordField
            label={t("currentPassword")}
            value={currentPassword}
            onChange={(v) => {
              setCurrentPassword(v);
              setErrors((prev) => ({ ...prev, currentPassword: undefined }));
            }}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((v) => !v)}
            disabled={isLoading}
            error={errors.currentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            label={t("newPassword")}
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setErrors((prev) => ({ ...prev, newPassword: undefined }));
            }}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((v) => !v)}
            disabled={isLoading}
            error={errors.newPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label={t("confirmPassword")}
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((v) => !v)}
            disabled={isLoading}
            error={errors.confirmPassword}
            last
            autoComplete="new-password"
          />
        </SectionCard>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-[49px] w-full items-center justify-center rounded-[14px] bg-[#2a602c] font-nunito text-sm font-extrabold leading-[21px] text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("saveChanges")
          )}
        </button>
      </form>
    </div>
  );
}
