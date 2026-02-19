/**
 * SEO utility functions
 * Generate metadata and structured data for pages
 */
import { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eklan.ai";
const siteName = "Eklan";
const defaultDescription = "Make English speaking feel natural with AI-powered practice";

/**
 * Generate page metadata
 */
export function generateMetadata({
  title,
  description = defaultDescription,
  path = "",
  image,
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = title.includes(siteName) ? title : `${title} - ${siteName}`;
  const url = `${baseUrl}${path}`;
  const ogImage = image || `${baseUrl}/og-image.png`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      siteName,
      title: fullTitle,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}

/**
 * Generate structured data (JSON-LD) for a page
 */
export function generateStructuredData({
  type = "WebPage",
  name,
  description,
  url,
  breadcrumbs,
}: {
  type?: string;
  name: string;
  description?: string;
  url: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}): object {
  const base = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    ...(description && { description }),
    url,
  };

  if (breadcrumbs && breadcrumbs.length > 0) {
    return {
      ...base,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
    };
  }

  return base;
}

/**
 * Generate organization structured data
 */
export function generateOrganizationStructuredData(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: baseUrl,
    logo: `${baseUrl}/icons/icon-512x512.png`,
    description: defaultDescription,
    sameAs: [
      // Add social media links here when available
    ],
  };
}


