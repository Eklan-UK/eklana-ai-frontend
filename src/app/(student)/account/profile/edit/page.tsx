"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Lightbulb, Upload, Loader2, X } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { getUserInitials } from "@/utils/user";
import { useRouter } from "next/navigation";
import { profileService } from "@/services/profile.service";
import { toast } from "sonner";
import Image from "next/image";

export default function EditProfilePage() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const initials = getUserInitials(user);

  // Load user data
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setDateOfBirth(
        user.dateOfBirth
          ? new Date(user.dateOfBirth).toISOString().split("T")[0]
          : ""
      );
      if (user.avatar) {
        setAvatarPreview(user.avatar);
      }
    }
  }, [user]);

  // Handle avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setIsUploadingAvatar(true);
    try {
      const result = await profileService.uploadAvatar(file);
      toast.success("Avatar uploaded successfully");
      // Update user in store
      if (user) {
        setUser({ ...user, avatar: result.avatarUrl });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar");
      setAvatarPreview(user?.avatar || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await profileService.updateProfile({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });

      toast.success("Profile updated successfully");
      router.back();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Edit Profile" />

      <div className="max-w-md mx-auto px-4 py-8 md:max-w-2xl md:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              {avatarPreview ? (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-green-500">
                  <Image
                    src={avatarPreview}
                    alt="Profile"
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-pink-400 via-primary-400 to-blue-400 flex items-center justify-center text-4xl md:text-5xl font-bold text-white border-4 border-green-500">
                  {initials}
                </div>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="mt-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploadingAvatar ? "Uploading..." : "Change Photo"}
            </Button>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Basic Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Input
                type="text"
                label="First Name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isLoading}
              />
              <Input
                type="text"
                label="Last Name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Input
              type="email"
              label="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="tel"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              disabled={isLoading}
            />

            <Input
              type="date"
              label="Date of Birth"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Card className="bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-6 h-6 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Profile Tips
                </p>
                <p className="text-xs text-gray-600">
                  A complete profile helps us personalize your learning
                  experience. All fields marked with * are required.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading || isUploadingAvatar}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
