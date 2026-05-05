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
        <span className="text-sm font-semibold text-foreground leading-5 flex-1 min-w-0">
          {title}
        </span>
        <span className="text-green-600 shrink-0 mt-0.5">
          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        </span>
      </button>
      {isOpen && (
        <div className="px-2 pt-2 pb-1 w-full text-sm text-foreground leading-5 space-y-2">
          {content}
        </div>
      )}
      <div className="w-full border-t border-[rgba(231,234,237,0.5)] mt-0" />
    </div>
  );
}

const sections: Section[] = [
  {
    title: "1. Who Is Responsible for Your Personal Data?",
    content: (
      <>
        <p>The entity responsible for processing your personal data is:</p>
        <p>
          <strong className="text-[#171717]">Eklan UK Limited</strong>
          <br />
          (&quot;Eklan&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
        </p>
      </>
    ),
  },
  {
    title: "2. Types of Information We Collect & Legal Basis for Processing",
    content: (
      <>
        <p>
          Depending on your interaction with Eklan, we collect two categories of data:
        </p>
        <p className="font-semibold text-[#171717]">A. Non-Personal Data</p>
        <p>
          Non-Personal Data is information that does not identify you and cannot
          reasonably be used to identify you.
        </p>
        <p>We may collect Non-Personal Data such as:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Date and time of interactions</li>
          <li>Pages or screens visited</li>
          <li>App usage statistics</li>
          <li>Email engagement data</li>
          <li>Device type and system information</li>
          <li>Aggregated analytics data</li>
        </ul>
        <p>How we use Non-Personal Data:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Analyze and improve our website and App</li>
          <li>Prevent fraud</li>
          <li>Conduct research and statistics</li>
          <li>Enhance performance and user experience</li>
        </ul>
        <p>This data is non-identifiable and may be used for any lawful purpose.</p>

        <p className="font-semibold text-[#171717]">B. Personal Information</p>
        <p>Personal Information identifies you as an individual. This includes:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Birth date</li>
          <li>Gender</li>
          <li>Location information</li>
          <li>Contact information</li>
          <li>Voice recordings</li>
          <li>Lesson transcripts</li>
          <li>App usage data</li>
          <li>Payment and billing information (when applicable)</li>
          <li>Any information you provide while interacting with the App or support team</li>
        </ul>
        <p>
          We use your Personal Information for various purposes under the following legal bases:
        </p>

        <p className="font-semibold text-[#171717]">
          i. Providing You with the Services (Contractual Necessity)
        </p>
        <p>To operate the App, we may collect:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Profile information</li>
          <li>Voice samples and recordings</li>
          <li>Pronunciation practice data</li>
          <li>Lesson transcripts</li>
          <li>App progress analytics</li>
        </ul>
        <p>
          We process this information to deliver the features, lessons, and
          recommendations that make Eklan work.
        </p>

        <p className="font-semibold text-[#171717]">
          ii. Customer Support & Communication (Contractual Necessity & Legitimate Interest)
        </p>
        <p>When you contact us, we may collect:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Name</li>
          <li>Email</li>
          <li>Phone number</li>
          <li>Support requests</li>
        </ul>
        <p>We use this information only to address your inquiry and improve user experience.</p>

        <p className="font-semibold text-[#171717]">
          iii. App, Website & Service Improvement (Legitimate Interest)
        </p>
        <p>We may collect:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Logs, IP addresses</li>
          <li>Device information</li>
          <li>Cookies and analytics data</li>
          <li>
            Conversation and practice data (e.g., voice inputs, corrections, performance metrics)
          </li>
        </ul>
        <p>This helps us:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Debug issues</li>
          <li>Improve accuracy of English pronunciation assessment</li>
          <li>Retrain and enhance AI models</li>
          <li>Maintain security</li>
          <li>Optimize performance</li>
        </ul>

        <p className="font-semibold text-[#171717]">
          iv. Marketing & Promotional Communications (Consent or Legitimate Interest)
        </p>
        <p>If you subscribe to updates or newsletters, we may collect:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Email address</li>
          <li>Name</li>
          <li>Country or region</li>
        </ul>
        <p>We will send:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Feature updates</li>
          <li>Newsletters</li>
          <li>Educational content</li>
          <li>Promotions or offers (only where legally permitted)</li>
        </ul>
        <p>You may unsubscribe anytime via the link in our emails.</p>
      </>
    ),
  },
  {
    title: "3. Cookies, Pixels & Web Beacons",
    content: (
      <>
        <p>Eklan uses cookies and similar technologies to:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Secure your account</li>
          <li>Personalize your experience</li>
          <li>Remember preferences</li>
          <li>Measure performance</li>
          <li>Run analytics</li>
          <li>Improve App functionality</li>
        </ul>
        <p>Cookies do not contain personal identity information.</p>
        <p>
          You may disable cookies at any time via your browser settings, but this may
          affect certain features of the website or App.
        </p>
      </>
    ),
  },
  {
    title: "4. Information Sharing & Disclosure",
    content: (
      <>
        <p>We do not sell your personal information.</p>
        <p>We may share information only under these circumstances:</p>

        <p className="font-semibold text-[#171717]">A. With Your Consent</p>
        <p>When you explicitly agree to share certain data.</p>

        <p className="font-semibold text-[#171717]">B. With Service Providers</p>
        <p>
          We may share data with trusted third-party partners who help us provide:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Speech recognition</li>
          <li>Cloud hosting</li>
          <li>Voice-to-text processing</li>
          <li>Customer support</li>
          <li>Analytics</li>
          <li>Payment processing</li>
        </ul>
        <p>
          They only receive the minimum information required and cannot use it for any
          other purpose.
        </p>

        <p className="font-semibold text-[#171717]">C. Business Transfers</p>
        <p>If Eklan undergoes:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Merger</li>
          <li>Acquisition</li>
          <li>Sale of assets</li>
          <li>Corporate restructuring</li>
        </ul>
        <p>your data may be transferred under strict confidentiality protections.</p>

        <p className="font-semibold text-[#171717]">D. Legal Requirements & Safety</p>
        <p>We may disclose data where necessary to:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Meet legal obligations</li>
          <li>Prevent fraud or misuse</li>
          <li>Protect safety of users or the public</li>
          <li>Respond to regulatory requests</li>
        </ul>

        <p className="font-semibold text-[#171717]">E. International Data Transfers</p>
        <p>Your information may be processed in countries outside your jurisdiction.</p>
        <p>
          Where required, we rely on Standard Contractual Clauses (SCCs) or other
          approved safeguards to protect your data.
        </p>
      </>
    ),
  },
  {
    title: "5. Data Retention",
    content: (
      <>
        <p>We retain your personal information only for as long as necessary to:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Provide the Services</li>
          <li>Comply with legal obligations</li>
          <li>Resolve disputes</li>
          <li>Improve App functionality</li>
        </ul>
        <p>
          Non-identifiable, anonymized data may be kept indefinitely for research and
          analytical purposes.
        </p>
      </>
    ),
  },
  {
    title: "6. Your Data Protection Rights",
    content: (
      <>
        <p>
          Depending on your region (e.g., GDPR, CCPA), you may have rights to:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Access your data</li>
          <li>Correct inaccurate information</li>
          <li>Delete your data (&quot;right to be forgotten&quot;)</li>
          <li>Restrict processing</li>
          <li>Request a copy of your data</li>
          <li>Object to marketing</li>
          <li>Withdraw consent</li>
        </ul>
        <p>To request any of these actions, contact us at:</p>
        <p>
          📩{" "}
          <a href="mailto:aaprivacy@eklan.ai" className={link}>
            aaprivacy@eklan.ai
          </a>
        </p>
      </>
    ),
  },
  {
    title: "7. Data Security",
    content: (
      <>
        <p>Eklan uses industry-standard:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Encryption</li>
          <li>Secure servers</li>
          <li>Access controls</li>
          <li>Monitoring tools</li>
          <li>Organizational and technical safeguards</li>
        </ul>
        <p>to protect your personal information.</p>
        <p>
          However, no system is completely secure. We encourage you to take steps such as:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Using strong passwords</li>
          <li>Keeping devices updated</li>
          <li>Avoiding public networks when logging in</li>
        </ul>
        <p>
          You also have the right to lodge a complaint to a data protection authority. If
          you are based in the European Union, information about how to contact a data
          protection authority is{" "}
          <a
            href="https://commission.europa.eu/law/law-topic/data-protection/reform/rights-citizens_en"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            available here
          </a>
          . If you are based in the UK, information about how to contact your local data
          protection authority is{" "}
          <a
            href="https://ico.org.uk/make-a-complaint/"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            available here
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "8. Third-Party Websites & Apps",
    content: (
      <>
        <p>Eklan may contain links to third-party services.</p>
        <p>
          We are not responsible for the privacy practices of external websites or apps.
        </p>
        <p>Please review their policies before sharing your information.</p>
      </>
    ),
  },
  {
    title:
      "9. Name and Contact Information of the Personal Data Protection Officer",
    content: (
      <>
        <p>
          For clarification regarding the procedure and requirements of exercising your
          rights, the empowered figure to provide attention is the Information Privacy
          Office. The contact details are as follows:{" "}
          <a href="mailto:aa@eklan.ai" className={link}>
            aa@eklan.ai
          </a>
        </p>
      </>
    ),
  },
  {
    title: "10. Changes to This Privacy Policy",
    content: (
      <>
        <p>Eklan may modify this Privacy Policy from time to time.</p>
        <p>Significant updates will be communicated via:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Email notices</li>
          <li>In-App notifications</li>
          <li>Website banner updates</li>
        </ul>
        <p>Your continued use of the Services signifies acceptance of the updated terms.</p>
      </>
    ),
  },
  {
    title: "11. Contact & Privacy Inquiries",
    content: (
      <>
        <p>For privacy questions or to exercise your data rights:</p>
        <p>
          📩{" "}
          <a href="mailto:aa@eklan.ai" className={link}>
            aa@eklan.ai
          </a>
        </p>
      </>
    ),
  },
];

export default function SettingsPrivacyPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) =>
    setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="min-h-screen bg-background">
      <div className="h-6" />
      <Header showBack title="Privacy Policy" />
      <div className="px-5 pt-6 pb-16">
        <h1 className="text-xl font-bold text-foreground leading-6 tracking-tight mb-4">
          Privacy Policy
        </h1>
        <div className="text-sm text-foreground leading-5 mb-4 space-y-3">
          <p>
            Eklan AI (&quot;Eklan&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
            respects your privacy and is committed to protecting the personal information
            you share with us. This Privacy Policy explains how we collect, use, store, and
            disclose your information when you use our website or our AI-powered language
            learning application designed to help you build English fluency (the
            &quot;App&quot; or the &quot;Services&quot;).
          </p>
          <p>
            By accessing our website or using our Services, you agree to the practices
            described in this Privacy Policy.
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
