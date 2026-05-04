"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useMemo } from "react";
import { useUserCurrent } from "@/hooks/useUserCurrent";
import {
  type AppLocale,
  htmlLangFromLocale,
  profileLanguageToLocale,
} from "@/i18n/locales";
import { mergeMessages } from "@/i18n/merge-messages";
import en from "@/i18n/messages/en.json";
import ko from "@/i18n/messages/ko.json";
import zh from "@/i18n/messages/zh.json";
import ja from "@/i18n/messages/ja.json";
import es from "@/i18n/messages/es.json";
import fr from "@/i18n/messages/fr.json";

const nonEnMessages: Record<Exclude<AppLocale, "en">, typeof ko> = {
  ko,
  zh,
  ja,
  es,
  fr,
};

export function StudentIntlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = useUserCurrent();
  const profileLang = data?.profile?.language;
  const locale = useMemo(
    () => profileLanguageToLocale(profileLang),
    [profileLang]
  );

  const messages = useMemo(() => {
    if (locale === "en") return en;
    const override = nonEnMessages[locale];
    return mergeMessages(en, override);
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = htmlLangFromLocale(locale);
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
