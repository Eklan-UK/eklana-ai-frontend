'use client';

import { Link2, Plus, Trash2 } from 'lucide-react';
import type { ClinicMatchingPair } from '@/hooks/usePrecisionClinic';
import { emptyPair } from './clinic-create-utils';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicInputClass,
	clinicSectionTitleClass,
	clinicHelperClass,
	clinicAddOutlineBtnClass,
} from './clinic-create-styles';

type Props = {
	pairs: ClinicMatchingPair[];
	onChange: (pairs: ClinicMatchingPair[]) => void;
};

export function ClinicMatchingPanel({ pairs, onChange }: Props) {
	const update = (index: number, patch: Partial<ClinicMatchingPair>) => {
		onChange(pairs.map((p, i) => (i === index ? { ...p, ...patch } : p)));
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
						<Link2 className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Matching Pairs <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Add pairs for students to match. Optional translations for context.
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicAddOutlineBtnClass}
					onClick={() => onChange([...pairs, emptyPair()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Pair
				</button>
			</div>
			<div className={`${clinicCardBodyClass} space-y-4`}>
				{pairs.map((pair, pi) => (
					<div
						key={pi}
						className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-border dark:bg-muted/20"
					>
						<div className="flex items-center justify-between">
							<p className="text-sm font-extrabold text-gray-900 dark:text-foreground">
								Pair {pi + 1}
							</p>
							{pairs.length > 1 ? (
								<button
									type="button"
									aria-label="Remove pair"
									className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
									onClick={() => onChange(pairs.filter((_, i) => i !== pi))}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							) : null}
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label className={clinicLabelClass}>
									Left Side <span className="text-red-500">*</span>
								</label>
								<input
									value={pair.left}
									onChange={(e) => update(pi, { left: e.target.value })}
									placeholder="e.g. hypertension"
									className={clinicInputClass}
								/>
							</div>
							<div>
								<label className={clinicLabelClass}>
									Right Side <span className="text-red-500">*</span>
								</label>
								<input
									value={pair.right}
									onChange={(e) => update(pi, { right: e.target.value })}
									placeholder="e.g. high blood pressure"
									className={clinicInputClass}
								/>
							</div>
							<div>
								<label className={clinicLabelClass}>Left Translation</label>
								<input
									value={pair.leftTranslation ?? ''}
									onChange={(e) =>
										update(pi, { leftTranslation: e.target.value })
									}
									placeholder="Translation..."
									className={clinicInputClass}
								/>
							</div>
							<div>
								<label className={clinicLabelClass}>Right Translation</label>
								<input
									value={pair.rightTranslation ?? ''}
									onChange={(e) =>
										update(pi, { rightTranslation: e.target.value })
									}
									placeholder="Translation..."
									className={clinicInputClass}
								/>
							</div>
						</div>
					</div>
				))}
				<button
					type="button"
					className={`${clinicAddOutlineBtnClass} w-full`}
					onClick={() => onChange([...pairs, emptyPair()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Pair
				</button>
			</div>
		</div>
	);
}
