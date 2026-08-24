"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Mail, Phone, Calendar, Globe2, Languages } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/store/auth-store";
import { getUserDisplayName } from "@/utils/user";
import { profileService } from "@/services/profile.service";
import { userAPI } from "@/lib/api";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { NATIONALITY_OPTIONS } from "@/lib/nationalities";
import { ProfileRadioRow } from "@/components/account/ProfileRadioRow";

function FieldShell({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        {children}
      </div>
    </div>
  );
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EditProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { user } = useAuthStore();
  const { data: me } = useUserCurrent();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationality, setNationality] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    const u = me?.user ?? user;
    if (!u) return;
    setName(getUserDisplayName(u));
    setEmail(u.email || "");
    setPhone(typeof u.phone === "string" ? u.phone : "");
    setDateOfBirth(toDateInputValue(u.dateOfBirth));
  }, [me?.user, user]);

  useEffect(() => {
    const profile = me?.profile;
    if (!profile) return;
    setNationality(profile.nationality?.trim() || "");
    setNativeLanguage(profile.nativeLanguage?.trim() || "");
  }, [me?.profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const trimmed = name.trim();
      const spaceIdx = trimmed.indexOf(" ");
      const firstName =
        spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
      const lastName = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : "";

      await profileService.updateProfile({
        firstName,
        lastName,
        email: email.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });

      await userAPI.updatePreferences({
        nationality: nationality || undefined,
        nativeLanguage: nativeLanguage || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success(t("profileUpdated"));
      router.back();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("updateFailed");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title={t("editTitle")} />

      <div className="max-w-md mx-auto px-5 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-[74px] h-[74px] shrink-0">
            {user?.avatar || me?.user?.avatar ? (
              <Image
                src={user?.avatar || me?.user?.avatar}
                alt="Profile"
                width={74}
                height={74}
                className="rounded-full object-cover w-full h-full border border-border"
              />
            ) : (
              <div className="w-full h-full rounded-full border border-border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                —
              </div>
            )}
          </div>
          <Link
            href="/account/profile/photo"
            className="border border-border rounded-3xl px-3 py-2.5 text-xs text-muted-foreground shrink-0"
          >
            {t("changePhotoAria")}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldShell label={t("fullName")} icon={User}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
              required
              disabled={isLoading}
            />
          </FieldShell>

          <FieldShell label={t("email")} icon={Mail}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
              required
              disabled={isLoading}
            />
          </FieldShell>

          <FieldShell label={t("phone")} icon={Phone}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
              disabled={isLoading}
            />
          </FieldShell>

          <FieldShell label={t("dateOfBirth")} icon={Calendar}>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              className="flex-1 bg-transparent text-base text-foreground outline-none min-w-0"
              disabled={isLoading}
              aria-describedby="dob-hint"
            />
          </FieldShell>
          <p id="dob-hint" className="text-xs text-muted-foreground -mt-1">
            {t("dateOfBirthHint")}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">
              {t("nationality")}
            </label>
            <button
              type="button"
              onClick={() => {
                setShowNationalityPicker((v) => !v);
                setShowLanguagePicker(false);
              }}
              className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2 text-left"
            >
              <Globe2 className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-base text-foreground truncate">
                {nationality || t("selectNationality")}
              </span>
            </button>
            {showNationalityPicker ? (
              <div className="mt-2 max-h-56 overflow-y-auto space-y-2 rounded-xl border border-border p-2">
                {NATIONALITY_OPTIONS.map((opt) => (
                  <ProfileRadioRow
                    key={opt.id}
                    selected={nationality === opt.label}
                    onSelect={() => {
                      setNationality(opt.label);
                      setShowNationalityPicker(false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span aria-hidden>{opt.flag}</span>
                      <span className="text-sm font-medium truncate">
                        {opt.label}
                      </span>
                    </div>
                  </ProfileRadioRow>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">
              {t("nativeLanguage")}
            </label>
            <button
              type="button"
              onClick={() => {
                setShowLanguagePicker((v) => !v);
                setShowNationalityPicker(false);
              }}
              className="bg-muted border border-border rounded-xl p-3 flex items-center gap-2 text-left"
            >
              <Languages className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-base text-foreground truncate">
                {nativeLanguage || t("selectNativeLanguage")}
              </span>
            </button>
            {showLanguagePicker ? (
              <div className="mt-2 max-h-56 overflow-y-auto space-y-2 rounded-xl border border-border p-2">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <ProfileRadioRow
                    key={opt.locale}
                    selected={nativeLanguage === opt.name}
                    onSelect={() => {
                      setNativeLanguage(opt.name);
                      setShowLanguagePicker(false);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {opt.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {opt.native}
                      </span>
                    </div>
                  </ProfileRadioRow>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-4 rounded-full text-base font-medium disabled:opacity-50 transition-opacity"
            >
              {isLoading ? tCommon("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
