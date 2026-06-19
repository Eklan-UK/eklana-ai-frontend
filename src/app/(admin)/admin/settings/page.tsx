"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Shield,
  Upload,
  User,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName, getUserInitials } from "@/utils/user";
import { profileService } from "@/services/profile.service";
import { authService } from "@/services/auth.service";
import { PrivacyPolicyAccordion } from "@/components/legal/PrivacyPolicyAccordion";
import { NpsFormSettingsSection } from "@/components/admin/NpsFormSettingsSection";

const PRESET_AVATARS: string[] = Array.from(
  { length: 30 },
  (_, i) =>
    `https://api.dicebear.com/9.x/avataaars/png?seed=eklan${
      i + 1
    }&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=128`
);

type SettingsSectionId = "profile" | "password" | "privacy" | "nps";

interface SettingsCardProps {
  id: SettingsSectionId;
  icon: React.ReactNode;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SettingsCard({
  title,
  description,
  icon,
  isOpen,
  onToggle,
  children,
}: SettingsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50/80 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-gray-600">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 truncate">{description}</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-0 border-t border-gray-100">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuthStore();
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const currentAvatar = user?.avatar ?? null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayAvatar = previewUrl ?? selectedAvatar ?? currentAvatar;
  const hasChanges =
    (selectedAvatar !== null && selectedAvatar !== currentAvatar) ||
    capturedFile !== null;

  const handleFileChosen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5 MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setCapturedFile(file);
        setSelectedAvatar(null);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const handleAvatarSelect = (url: string) => {
    setSelectedAvatar(url);
    setCapturedFile(null);
    setPreviewUrl(null);
  };

  const handleSaveAvatar = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      if (capturedFile) {
        await profileService.uploadAvatar(capturedFile);
        toast.success("Profile photo updated");
      } else if (selectedAvatar) {
        await profileService.setPresetAvatar(selectedAvatar);
        toast.success("Avatar updated");
      }
      setSelectedAvatar(null);
      setCapturedFile(null);
      setPreviewUrl(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile photo";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
        <div className="relative w-20 h-20 shrink-0">
          {displayAvatar ? (
            <Image
              src={displayAvatar}
              alt={displayName}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-emerald-100 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-2xl font-bold text-white">
              {initials}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center border-2 border-white">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900">{displayName}</p>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChosen}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-4">Choose an avatar</p>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {PRESET_AVATARS.map((url, idx) => {
            const isSelected = selectedAvatar === url;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleAvatarSelect(url)}
                className={`relative w-full aspect-square rounded-full overflow-hidden transition-all ${
                  isSelected
                    ? "ring-2 ring-emerald-500 ring-offset-2"
                    : "ring-0 hover:ring-1 hover:ring-gray-200"
                }`}
                aria-label={`Select avatar ${idx + 1}`}
                aria-pressed={isSelected}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Avatar option ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      </div>

      {hasChanges && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedAvatar(null);
              setCapturedFile(null);
              setPreviewUrl(null);
            }}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAvatar}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#418b43] rounded-xl hover:bg-[#3a7c3b] disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save photo"
            )}
          </button>
        </div>
      )}
    </>
  );
}

function ChangePasswordSection() {
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
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword =
        "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to change password";
      toast.error(message);
      if (
        message.includes("current password") ||
        message.includes("incorrect")
      ) {
        setErrors({ currentPassword: "Current password is incorrect" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>At least 8 characters long</li>
            <li>Must be different from your current password</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setErrors((prev) => ({ ...prev, currentPassword: undefined }));
          }}
          show={showCurrentPassword}
          onToggleShow={() => setShowCurrentPassword((v) => !v)}
          error={errors.currentPassword}
          disabled={isLoading}
        />
        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setErrors((prev) => ({ ...prev, newPassword: undefined }));
          }}
          show={showNewPassword}
          onToggleShow={() => setShowNewPassword((v) => !v)}
          error={errors.newPassword}
          disabled={isLoading}
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          show={showConfirmPassword}
          onToggleShow={() => setShowConfirmPassword((v) => !v)}
          error={errors.confirmPassword}
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#418b43] rounded-xl hover:bg-[#3a7c3b] disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Changing…
            </>
          ) : (
            "Change Password"
          )}
        </button>
      </form>
    </>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
            error ? "border-red-300" : "border-gray-200"
          }`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function LogoutCard() {
  const router = useRouter();
  const { logout, isLoading } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/auth/admin/login");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to log out";
      toast.error(message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-red-50/60 transition-colors disabled:opacity-50"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center text-red-600">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-red-600">Logout</h2>
            <p className="text-sm text-gray-500">
              Sign out of your admin account on this device
            </p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin text-red-400" />
        ) : null}
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSection((current) => (current === id ? null : id));
  };

  const settingsItems: Array<{
    id: SettingsSectionId;
    icon: React.ReactNode;
    title: string;
    description: string;
    content: React.ReactNode;
  }> = [
    {
      id: "profile",
      icon: <User className="w-5 h-5" />,
      title: "Profile",
      description: "Update your profile photo and avatar",
      content: <ProfileSection />,
    },
    {
      id: "password",
      icon: <Lock className="w-5 h-5" />,
      title: "Change Password",
      description: "Update your account password",
      content: <ChangePasswordSection />,
    },
    {
      id: "privacy",
      icon: <Shield className="w-5 h-5" />,
      title: "Privacy Policy",
      description: "How Eklan collects, uses, and protects your data",
      content: <PrivacyPolicyAccordion />,
    },
    {
      id: "nps",
      icon: <ClipboardList className="w-5 h-5" />,
      title: "NPS Form",
      description: "Configure the post-session Google Forms survey",
      content: <NpsFormSettingsSection />,
    },
  ];

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">
          Manage your admin profile, security, and account preferences
        </p>
      </div>

      <div className="space-y-3">
        {settingsItems.map((item) => (
          <SettingsCard
            key={item.id}
            id={item.id}
            icon={item.icon}
            title={item.title}
            description={item.description}
            isOpen={openSection === item.id}
            onToggle={() => toggleSection(item.id)}
          >
            {item.content}
          </SettingsCard>
        ))}

        <LogoutCard />
      </div>
    </div>
  );
}
