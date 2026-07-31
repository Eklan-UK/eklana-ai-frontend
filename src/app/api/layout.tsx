/**
 * Opt the entire /api tree out of static generation.
 *
 * Most route handlers import Mongoose models / Better Auth / Stripe / etc.
 * When Next.js tries to statically generate those segments during `next build`,
 * workers load heavy server graphs and peak RAM balloons on Vercel (~8GB).
 */
export const dynamic = 'force-dynamic';

export default function ApiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
