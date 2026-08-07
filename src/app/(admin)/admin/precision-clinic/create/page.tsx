'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ClinicCreateShell } from '@/components/precision-clinic/create';

function PrecisionClinicCreatePageContent() {
	return <ClinicCreateShell />;
}

export default function PrecisionClinicCreatePage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-[400px] items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-[#418b43]" />
				</div>
			}
		>
			<PrecisionClinicCreatePageContent />
		</Suspense>
	);
}
