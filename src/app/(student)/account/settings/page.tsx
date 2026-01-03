"use client";

import { Header } from "@/components/layout/Header";
import {
  Globe,
  Languages,
  Target,
  Bell,
  BookOpen,
  Palette,
  HelpCircle,
  CreditCard,
  Shield,
  FileText,
  ChevronRight,
  Lock,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials, getUserDisplayName } from "@/utils/user";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { authService } from "@/services/auth.service";
import { useState } from "react";

// Types
interface SettingItemProps {
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  isDanger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItemProps[];
}

// Constants
const SECURITY_SETTINGS: SettingItemProps[] = [
  {
    label: "Change Password",
    href: "/account/settings/password",
    icon: <Lock className="w-5 h-5 text-gray-600" />,
  },
];

const PREFERENCE_SETTINGS: SettingItemProps[] = [
  {
    label: "Nationality",
    value: "Korean",
    href: "/account/settings/nationality",
    icon: <Globe className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "App language",
    value: "English",
    href: "/account/settings/language",
    icon: <Languages className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Learning goals",
    value: "Speak...",
    href: "/account/settings/goals",
    icon: <Target className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Notifications",
    href: "/account/settings/notifications",
    icon: <Bell className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Lesson",
    href: "/account/settings/lesson",
    icon: <BookOpen className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Theme",
    href: "/account/settings/theme",
    icon: <Palette className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Help",
    href: "/account/settings/help",
    icon: <HelpCircle className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Subscriptions",
    href: "/account/settings/subscriptions",
    icon: <CreditCard className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Privacy policy",
    href: "/account/settings/privacy",
    icon: <Shield className="w-5 h-5 text-gray-600" />,
  },
  {
    label: "Terms of use",
    href: "/account/settings/terms",
    icon: <FileText className="w-5 h-5 text-gray-600" />,
  },
];

// Components
function UserProfileSection() {
  const { user } = useAuthStore();
  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);

  return (
    <div className="flex items-center gap-4 py-6 border-b border-gray-100">
      {user?.avatar ? (
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-green-500">
          <Image
            src={user.avatar}
            alt={displayName}
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-2xl md:text-3xl font-bold text-white">
          {initials}
        </div>
      )}
      <div className="flex-1">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
          {displayName}
        </h3>
        <Link
          href="/account/profile/edit"
          className="text-sm text-green-600 font-medium"
        >
          Edit profile
        </Link>
      </div>
    </div>
  );
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  value,
  href,
  onClick,
  icon,
  isDanger = false,
}) => {
  const content = (
    <div
      className={`flex items-center justify-between py-4 border-b border-gray-100 ${
        isDanger ? "text-red-600" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-base font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-500">{value}</span>}
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
};

function EmailVerificationSection() {
  const { user } = useAuthStore();
  const [isSending, setIsSending] = useState(false);
  const isEmailVerified = user?.isEmailVerified || user?.emailVerified;

  const handleSendVerification = async () => {
    setIsSending(true);
    try {
      await authService.sendVerificationEmail();
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="py-4 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Mail className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <span className="text-base font-medium text-gray-900">
              Email Verification
            </span>
            <div className="flex items-center gap-2 mt-1">
              {isEmailVerified ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">Verified</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">Not Verified</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!isEmailVerified && (
          <button
            onClick={handleSendVerification}
            disabled={isSending}
            className="text-sm text-green-600 font-medium hover:underline disabled:opacity-50 flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Verify"
            )}
          </button>
        )}
      </div>
      {!isEmailVerified && (
        <p className="text-xs text-gray-500 mt-2 ml-8">
          Verify your email to secure your account
        </p>
      )}
    </div>
  );
}

function SettingsSection({ title, items }: SettingSection) {
  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
        {title}
      </h3>
      {items.map((item, index) => (
        <SettingItem key={`${item.label}-${index}`} {...item} />
      ))}
    </div>
  );
}

function LogoutButton() {
  const { logout, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch (error: any) {
      toast.error(error?.message || "Failed to logout");
    }
  };

  return (
    <div className="pt-4">
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full text-center py-4 text-red-600 font-semibold disabled:opacity-50"
      >
        {isLoading ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}

function VersionInfo() {
  return (
    <div className="pt-8 pb-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 12L4 8L8 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>eklan version 1.0</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 8L8 12L12 8L8 4L12 8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-white pb-6">
      <div className="h-6"></div>
      <Header showBack title="Settings" />

      <div className="max-w-md mx-auto px-4 md:max-w-2xl md:px-8">
        <UserProfileSection />

        {/* Security Section with Email Verification */}
        <div className="py-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
            Security
          </h3>
          <EmailVerificationSection />
          {SECURITY_SETTINGS.map((item, index) => (
            <SettingItem key={`security-${index}`} {...item} />
          ))}
        </div>

        {/* Preferences Section */}
        <SettingsSection title="Preferences" items={PREFERENCE_SETTINGS} />

        <LogoutButton />
        <VersionInfo />
      </div>
    </div>
  );
}
