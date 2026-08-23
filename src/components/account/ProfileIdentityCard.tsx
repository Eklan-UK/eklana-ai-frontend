"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ProfileStatTriple,
  type ProfileStatItem,
} from "@/components/account/ProfileStatTriple";

const CARD_GREEN = "#2a602c";

export function ProfileIdentityCard({
  name,
  email,
  planLabel,
  avatarUri,
  initial,
  photoHref,
  changePhotoAria,
  stats,
}: {
  name: string;
  email: string;
  planLabel: string;
  avatarUri?: string | null;
  initial: string;
  photoHref: string;
  changePhotoAria: string;
  stats: [ProfileStatItem, ProfileStatItem, ProfileStatItem];
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[24px]"
      style={{ backgroundColor: CARD_GREEN }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute size-[176px] rounded-full bg-white/[0.08]"
        style={{ left: "62%", top: -40 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute size-[112px] rounded-full bg-white/[0.06]"
        style={{ left: "62%", top: 48 }}
      />

      <div className="relative flex items-center gap-4 px-5 pb-5 pt-6">
        <Link
          href={photoHref}
          aria-label={changePhotoAria}
          className="relative size-20 shrink-0"
        >
          {avatarUri ? (
            <div className="size-20 overflow-hidden rounded-full">
              <Image
                src={avatarUri}
                alt={name}
                width={80}
                height={80}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div
              className="flex size-20 items-center justify-center overflow-hidden rounded-full"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%)",
              }}
            >
              <span className="font-nunito text-[28px] font-extrabold leading-[42px] text-white">
                {initial}
              </span>
            </div>
          )}
          <span className="absolute left-14 top-14 block size-6 overflow-hidden">
            <Image
              src="/icons/profile/camera-badge.svg"
              alt=""
              width={24}
              height={24}
              className="size-full"
              unoptimized
            />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate font-nunito text-[21px] font-extrabold leading-[26.25px] text-white">
            {name}
          </p>
          <p className="mt-0.5 truncate font-nunito text-[12.5px] font-semibold leading-[18.75px] text-white/72">
            {email}
          </p>
          <span className="mt-2.5 inline-flex items-center justify-center rounded-full border border-white/70 px-3 py-0.5">
            <span className="font-nunito text-[11.5px] font-extrabold leading-[17.25px] text-white">
              {planLabel}
            </span>
          </span>
        </div>
      </div>

      <div className="relative px-5">
        <div className="h-px w-full bg-white/20" />
      </div>

      <ProfileStatTriple items={stats} variant="onDark" />
    </div>
  );
}
