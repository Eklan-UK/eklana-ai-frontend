"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Header } from "@/components/layout/Header";

const link =
  "text-green-600 underline underline-offset-2 hover:text-green-700 break-all";

type Section = {
  title: string;
  content: React.ReactNode;
};

function AccordionItem({
  title,
  content,
  isOpen,
  onToggle,
}: {
  title: string;
  content: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col items-start w-full">
      <button
        onClick={onToggle}
        className="flex items-start justify-between w-full p-3 rounded-lg border border-[rgba(231,234,237,0.5)] text-left gap-2"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-[#171717] leading-5 flex-1 min-w-0">
          {title}
        </span>
        <span className="text-green-600 shrink-0 mt-0.5">
          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>
      {isOpen && (
        <div className="px-2 pt-2 pb-1 w-full text-sm text-[#333] leading-5 space-y-2">
          {content}
        </div>
      )}
      <div className="w-full border-t border-[rgba(231,234,237,0.5)] mt-0" />
    </div>
  );
}

const sections: Section[] = [
  {
    title: "1. The App and Services",
    content: (
      <>
        <p>
          Eklan is an AI-powered language learning application that enables users to
          learn and improve English pronunciation, conversational fluency, and related
          language skills through interactive, conversation-based lessons with an AI
          tutor (the &quot;Services&quot;).
        </p>
        <p>
          The Services may include push notifications, messages, emails and other
          alerts. The Services may also include third-party advertisements and/or
          commercial content.
        </p>
        <p>
          You can deactivate push notifications at any time by changing your
          notification settings in the App or on your device.
        </p>
        <p>
          The Services are available only to individuals over the age of 16 who can form
          legally binding contracts under applicable law and who intend to use the App
          for personal use. Subject to these Terms and Conditions, Eklan grants You a
          limited, personal, non-transferable, non-exclusive, non-assignable,
          non-sublicensable license to access and use the Services and App.
        </p>
        <p>
          You hereby warrant that you have the legal capacity and authority to enter
          into these Terms and Conditions.
        </p>
      </>
    ),
  },
  {
    title: "2. Registration",
    content: (
      <>
        <p>
          To use certain features of the App and Services you may be required to
          register and create a user account. As part of registration you may be
          required to pay a registration fee, provide certain personal information (e.g.,
          name, phone number, email) and select a password. You must provide accurate,
          complete and updated information and comply with all applicable laws.
        </p>
        <p>
          You must not: (i) impersonate another person; (ii) use as a username a name
          subject to any third-party rights without authorization; or (iii) access
          another user&apos;s account without permission.
        </p>
        <p>
          Eklan may refuse registration or block access at its sole discretion. You are
          solely responsible for activity on your account and for maintaining the
          confidentiality of your credentials. Notify Eklan immediately of any
          unauthorized use. Eklan will not be liable for losses caused by unauthorized
          use of your account.
        </p>
      </>
    ),
  },
  {
    title: "3. Payment",
    content: (
      <>
        <p>
          Certain Services and features are offered under a monthly and/or annual paid
          subscription (the &quot;Paid Content&quot;). You agree to pay the fees and
          charges presented when you subscribe (&quot;Fees&quot;). For recurring
          subscriptions, you agree to pay Fees according to the applicable billing cycle.
          You are responsible for all taxes and charges incurred on your account. If
          acting on behalf of an entity, you are authorized to bind that entity.
        </p>
        <p>
          Eklan uses third-party payment processors (e.g., Apple App Store, Google Play
          Store, Stripe) to facilitate payments. Purchases are subject to the payment
          processors&apos; terms, policies and refund rules. To cancel a subscription
          billed via a third party, follow that provider&apos;s cancellation process.
        </p>
        <p>
          Eklan may offer a Trial Period for Paid Content for promotional purposes.
          Eligibility, duration and terms of Trial Periods are determined by Eklan and
          may require valid payment information. If you do not cancel before the Trial
          Period ends, you authorize Eklan (or the relevant payment processor) to begin
          billing your selected subscription automatically. To avoid charges, cancel
          the subscription prior to the Trial Period&apos;s end. If you cancel, you
          will retain access only to features available for free.
        </p>
      </>
    ),
  },
  {
    title: "4. Intellectual Property and License",
    content: (
      <>
        <p>
          Eklan retains all right, title and interest in and to the App, Services and
          all related intellectual property rights. Subject to these Terms and
          Conditions, Eklan grants you a limited, non-transferable, non-exclusive,
          non-assignable, non-sublicensable license to access and use the App and
          Services solely for their intended purpose. You will not alter or modify any
          part of the App or Services other than as reasonably necessary to use them.
        </p>
        <p>
          All content provided by Eklan (including photos, illustrations, text, audio,
          designs, trademarks, the &quot;look and feel&quot; and any other material)
          (&quot;Eklan Content&quot;) is owned by Eklan and/or its licensors. You may not
          copy, reproduce, modify, publicly display, distribute, sell, license, rent,
          transfer, create derivative works from, or otherwise exploit Eklan Content
          without Eklan&apos;s prior written consent.
        </p>
        <p>
          If you provide Eklan feedback or suggestions regarding the App or Services,
          you acknowledge Eklan may use them at its discretion without any obligation to
          compensate you.
        </p>
      </>
    ),
  },
  {
    title: "5. User Content and Generated Content",
    content: (
      <>
        <p>
          You may create, upload, store, post, publish or otherwise provide content
          through the App (including profile information, photos, text, video and audio
          recordings) (&quot;User Content&quot;).
        </p>
        <p>
          User Content you share with other users or designate as public will be
          treated as non-confidential; you waive privacy rights in respect of such
          shared content. You may disable sharing features in your account settings where
          applicable.
        </p>
        <p>
          During your use of the Services Eklan may create or derive content from your
          inputs (e.g., corrected pronunciations, lesson snippets, composite audio/text
          created by combining elements) (&quot;Generated Content&quot;). Generated
          Content may be made available via the App subject to your prior consent where
          required.
        </p>
        <p>
          You represent and warrant that you own or have all necessary rights, consents
          and permissions to provide the User Content and to grant the rights and
          licenses set forth in these Terms. You will not upload or provide any content
          that infringes third-party rights or violates any law.
        </p>
        <p>
          By submitting User Content to Eklan, you grant Eklan an irrevocable,
          perpetual, non-exclusive, worldwide, royalty-free, sublicensable license to
          use, copy, store, modify, adapt, publish, distribute, publicly perform and
          display such content and to create derivative works for the purpose of
          providing, operating and improving the App and Services.
        </p>
        <p>
          You are solely responsible for User Content you provide. Eklan disclaims
          liability in relation to User Content to the fullest extent permitted by law.
        </p>
      </>
    ),
  },
  {
    title: "6. Restrictions on Use",
    content: (
      <>
        <p>
          You represent that you have authority to enter these Terms and to use the
          Services. If you become aware of an unauthorized use of the App, notify Eklan
          promptly.
        </p>
        <p>
          You will not, nor permit others to, use the App or Services to: (a) post or
          transmit material that is defamatory, abusive, harassing, threatening, hateful,
          racially or otherwise offensive, invasive of privacy, obscene or otherwise
          objectionable; (b) infringe intellectual property or other third-party rights;
          (c) facilitate or encourage illegal activity; (d) attempt to obtain passwords
          or private information from others; (e) introduce malware, viruses, trojans or
          other harmful code; (f) impersonate any person; (g) stalk, harass, spam or
          otherwise abuse other users; or (h) violate any applicable law.
        </p>
        <p>
          You shall not (a) circumvent, disable or otherwise interfere with any security
          feature of the App; (b) sell, sublicense, rent, lease, distribute, transfer or
          make the App or Services available to third parties; (c) decompile, reverse
          engineer or otherwise attempt to access or derive source code; (d) use
          automated means (including crawling, scraping or caching) to access or interact
          with the App without Eklan&apos;s express consent; or (e) use the App in any
          manner not authorized by these Terms.
        </p>
      </>
    ),
  },
  {
    title: "7. Third Party Websites",
    content: (
      <>
        <p>
          The App may contain links to third-party websites, applications or services
          that are not owned or controlled by Eklan. Eklan is not responsible for their
          availability, content, accuracy or privacy practices. If you visit third-party
          sites or use third-party services, their terms and privacy policies will apply.
          Eklan does not endorse and is not liable for third-party sites or content.
        </p>
      </>
    ),
  },
  {
    title: "8. Usage Rules (Platform Providers)",
    content: (
      <>
        <p>
          If you downloaded the App through a platform provider (e.g., Apple App Store,
          Google Play Store, Amazon Appstore), your use of the App may also be governed
          by the platform provider&apos;s usage rules. It is your responsibility to
          determine which Usage Rules apply. To the extent of any conflict between these
          Terms and the platform provider&apos;s rules, the platform provider&apos;s
          rules shall prevail.
        </p>
      </>
    ),
  },
  {
    title: "9. Termination",
    content: (
      <>
        <p>
          Eklan may terminate or suspend your account and access to the App and Services
          (or any part thereof) immediately and without prior notice or liability.
          Provisions that by their nature should survive termination (including ownership
          provisions, warranty disclaimers, indemnities and limitation of liability) will
          survive. Termination does not relieve you of obligations accrued prior to
          termination.
        </p>
      </>
    ),
  },
  {
    title: "10. Privacy Policy",
    content: (
      <>
        <p>
          Eklan collects and uses personal information in accordance with its Privacy
          Policy, which is incorporated into these Terms. Please review our Privacy
          Policy at{" "}
          <a
            href="https://www.eklan.ai/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            https://www.eklan.ai/privacy
          </a>{" "}
          for details on how we collect, use and disclose information. By using the App
          you agree to the terms of the Privacy Policy.
        </p>
      </>
    ),
  },
  {
    title: "11. Warranty Disclaimer",
    content: (
      <>
        <p className="font-semibold">
          YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT YOUR USE OF THE APP AND SERVICES IS
          AT YOUR SOLE RISK. THE APP AND SERVICES ARE PROVIDED &quot;AS IS&quot; AND
          &quot;AS AVAILABLE,&quot; WITHOUT WARRANTY OF ANY KIND. EKLAN DOES NOT WARRANT
          THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR MEET YOUR REQUIREMENTS.
          EKLAN MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
          BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, NON-INFRINGEMENT, ACCURACY, OR COMPLETENESS.
        </p>
        <p>
          The App relies on artificial intelligence and machine learning. Outputs
          generated by the App (including conversation responses, assessments,
          suggestions and corrections) are highly dependent on user input and the
          limitations of current AI technology. Any responses generated to disallowed
          content are not endorsed by Eklan and are the user&apos;s sole responsibility.
        </p>
        <p>
          Eklan does not provide medical, legal, psychological, or other professional
          services. If you believe you are experiencing an emergency or require
          professional assistance, contact local emergency services or appropriate
          professionals immediately.
        </p>
      </>
    ),
  },
  {
    title: "12. Limitation of Liability",
    content: (
      <>
        <p className="font-semibold">
          TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL EKLAN, ITS
          AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES OR AGENTS BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES,
          LOSS OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, OR OTHER PECUNIARY LOSS
          ARISING OUT OF OR IN CONNECTION WITH THESE TERMS, THE APP, THE SERVICES OR
          YOUR USE OR INABILITY TO USE THE APP, EVEN IF ADVISED OF THE POSSIBILITY OF
          SUCH DAMAGES.
        </p>
        <p className="font-semibold">
          IN NO EVENT SHALL EKLAN&apos;S AGGREGATE LIABILITY ARISING OUT OF OR IN
          CONNECTION WITH THESE TERMS EXCEED THE FEES PAID BY YOU TO EKLAN FOR THE
          SERVICES GIVING RISE TO THE CLAIM DURING THE TWELVE (12) MONTHS PRIOR TO THE
          EVENT GIVING RISE TO THE CLAIM (IF ANY).
        </p>
      </>
    ),
  },
  {
    title: "13. Indemnification",
    content: (
      <>
        <p>
          You agree to defend, indemnify and hold harmless Eklan and its officers,
          directors, employees, agents and affiliates from and against any claims,
          liabilities, damages, losses and expenses (including reasonable
          attorneys&apos; fees and costs) arising from or related to: (i) your use or
          misuse of the App and Services; (ii) your violation of these Terms or
          third-party rights (including privacy or intellectual property rights); or
          (iii) your User Content.
        </p>
      </>
    ),
  },
  {
    title: "14. Reporting of Intellectual Property Infringements",
    content: (
      <>
        <p>
          If you believe in good faith that any material on or available through the App
          infringes your copyright or other intellectual property rights, please notify
          us promptly by email to:{" "}
          <a href="mailto:aa@eklan.ai" className={link}>
            aa@eklan.ai
          </a>{" "}
          with sufficient information to permit Eklan to investigate the claim.
        </p>
      </>
    ),
  },
  {
    title: "15. Miscellaneous",
    content: (
      <>
        <p className="font-semibold text-[#171717]">Governing Law & Jurisdiction.</p>
        <p>
          These Terms and Conditions and their performance shall be governed by the laws
          of England and Wales. The parties submit to the exclusive jurisdiction of the
          courts of England and Wales.
        </p>
        <p className="font-semibold text-[#171717]">Entire Agreement.</p>
        <p>
          These Terms and Conditions together with the Privacy Policy constitute the
          entire agreement between you and Eklan concerning the App and Services and
          supersede prior agreements.
        </p>
        <p className="font-semibold text-[#171717]">Severability.</p>
        <p>
          If a court finds any provision of these Terms to be invalid or unenforceable,
          the remaining provisions remain in full force.
        </p>
        <p className="font-semibold text-[#171717]">No Waiver.</p>
        <p>
          Failure by Eklan to enforce any right or provision is not a waiver unless
          acknowledged in writing.
        </p>
        <p className="font-semibold text-[#171717]">Data Usage & Bandwidth.</p>
        <p>
          You acknowledge the App may consume mobile or broadband data as permitted by
          these Terms and our Privacy Policy.
        </p>
        <p className="font-semibold text-[#171717]">Changes to App.</p>
        <p>
          Eklan may change, suspend or discontinue the App or Services (or any part) at
          any time without notice or liability.
        </p>
        <p className="font-semibold text-[#171717]">Assignment.</p>
        <p>
          Eklan may assign its rights or obligations under these Terms at any time
          without your consent.
        </p>
        <p className="font-semibold text-[#171717]">Contact.</p>
        <p>
          If you have any questions about these Terms, the App or Services, contact us
          at:{" "}
          <a href="mailto:aa@eklan.ai" className={link}>
            aa@eklan.ai
          </a>
          .
        </p>
        <p className="font-semibold text-[#171717] uppercase tracking-wide text-center mt-2">
          YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD AND AGREE TO BE BOUND BY THESE
          TERMS AND CONDITIONS.
        </p>
      </>
    ),
  },
];

export default function SettingsTermsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) =>
    setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6" />
      <Header showBack title="Terms of Use" />
      <div className="px-5 pt-6 pb-16">
        <h1 className="text-xl font-bold text-[#171717] leading-6 tracking-tight mb-4">
          Terms of use
        </h1>
        <div className="text-sm text-black leading-5 mb-4 space-y-3">
          <p>
            These terms and conditions (&quot;Terms and Conditions&quot;) constitute a
            legally binding agreement between you, the user who will be utilizing Eklan
            AI&apos;s webapp (referenced below as &quot;You&quot; or &quot;User&quot;),
            and Eklan UK Limited, a company incorporated under the laws of England and
            Wales (&quot;Eklan&quot;, &quot;We&quot;, or &quot;Us&quot;), with respect to
            your use of Eklan&apos;s services (as defined below) which are available via
            Eklan&apos;s webapp and mobile applications (the &quot;App&quot;).
          </p>
          <p>
            By accessing or using the App and/or Services you accept and agree to be
            bound by these Terms and Conditions and our Privacy Policy, which is
            incorporated herein by reference. Eklan reserves the right, in its sole
            discretion, to modify these Terms and Conditions (including any other
            policies incorporated herein) at any time by posting the modified provisions
            at{" "}
            <a
              href="https://www.eklan.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              https://www.eklan.ai/
            </a>
            . Any such modifications shall become effective immediately upon posting.
          </p>
          <p className="font-semibold text-[#171717] uppercase text-xs tracking-wide">
            IF YOU DO NOT AGREE TO ALL OF THESE TERMS AND CONDITIONS, DO NOT ACCESS OR
            USE ANY PART OF THE APP OR SERVICES.
          </p>
        </div>
        <p className="text-xs text-gray-400 mb-5">Last updated: February 6, 2026</p>
        <div className="flex flex-col gap-1">
          {sections.map((section, i) => (
            <AccordionItem
              key={i}
              title={section.title}
              content={section.content}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
