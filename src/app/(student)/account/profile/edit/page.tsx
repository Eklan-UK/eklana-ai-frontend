"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName } from "@/utils/user";
import { useRouter } from "next/navigation";
import { profileService } from "@/services/profile.service";
import { toast } from "sonner";
import Image from "next/image";
import { User, Mail } from "lucide-react";

export default function EditProfilePage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (user) {
      setName(getUserDisplayName(user));
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const trimmed = name.trim();
      const spaceIdx = trimmed.indexOf(" ");
      const firstName =
        spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
      const lastName = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : "";
      await profileService.updateProfile({ firstName, lastName, email });
      toast.success("Profile updated");
      router.back();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await profileService.deleteAccount();
      toast.success("Account deleted");
      router.push("/auth/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title="Edit profile" />

      <div className="max-w-md mx-auto px-5 pt-6 pb-10">
        {/* Avatar row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-[74px] h-[74px] shrink-0">
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt="Profile"
                width={74}
                height={74}
                className="rounded-full object-cover w-full h-full border border-[#ecffed]"
              />
            ) : (
              <div className="w-full h-full rounded-full border border-[#ecffed] bg-muted flex items-center justify-center">
                {/* empty-state image icon matching Figma frame 2 */}
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 52 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6.5 40.625L17.333 29.792a3.25 3.25 0 014.594 0l3.64 3.64 6.166-6.165a3.25 3.25 0 014.594 0L45.5 40.625"
                    stroke="#c8c8c8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="6.5"
                    y="9.75"
                    width="39"
                    height="32.5"
                    rx="3.25"
                    stroke="#c8c8c8"
                    strokeWidth="2"
                  />
                  <circle
                    cx="19.5"
                    cy="22.75"
                    r="3.25"
                    stroke="#c8c8c8"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push("/account/profile/photo")}
            className="border border-[rgba(231,234,237,0.5)] rounded-3xl px-[10px] py-[10px] text-xs text-[#606060] shrink-0"
          >
            Change photo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name field */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">Name</label>
            <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-1">
              <User className="w-6 h-6 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Email field */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground font-nunito">Email</label>
            <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-1">
              <Mail className="w-6 h-6 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="pt-10">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-4 rounded-[50px] text-base font-medium disabled:opacity-50 transition-opacity"
            >
              {isLoading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Delete my account */}
        <div className="mt-8">
          <div className="flex items-start justify-between py-2 border-b border-[rgba(231,234,237,0.5)]">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-[#ff0e0e]"
            >
              Delete my account
            </button>
          </div>
        </div>
      </div>

      {/* Delete-account confirmation bottom sheet */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-card rounded-t-[32px] w-full px-4 pt-5 pb-8 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-foreground mb-2">
              Delete account?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This action is permanent. All your data, progress and
              subscription will be lost.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="w-full py-4 bg-[#ff0e0e] text-white rounded-[50px] font-medium mb-3 disabled:opacity-50 transition-opacity"
            >
              {isDeletingAccount ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-4 border border-border rounded-[50px] text-foreground font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
