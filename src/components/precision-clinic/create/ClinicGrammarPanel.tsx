'use client';

import { BookOpen, Plus, Trash2 } from 'lucide-react';
import type { ClinicGrammarPattern } from '@/hooks/usePrecisionClinic';
import { emptyPattern } from './clinic-create-utils';
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
	patterns: ClinicGrammarPattern[];
	onChange: (patterns: ClinicGrammarPattern[]) => void;
};

export function ClinicGrammarPanel({ patterns, onChange }: Props) {
	const update = (index: number, patch: Partial<ClinicGrammarPattern>) => {
		onChange(patterns.map((p, i) => (i === index ? { ...p, ...patch } : p)));
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
						<BookOpen className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Grammar Patterns <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Define patterns with example sentences and optional hints.
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicAddOutlineBtnClass}
					onClick={() => onChange([...patterns, emptyPattern()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Pattern
				</button>
			</div>
			<div className={`${clinicCardBodyClass} space-y-4`}>
				{patterns.map((pattern, pi) => (
					<div
						key={pi}
						className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-border dark:bg-muted/20"
					>
						<div className="flex items-center justify-between">
							<p className="text-sm font-extrabold text-gray-900 dark:text-foreground">
								Pattern {pi + 1}
							</p>
							{patterns.length > 1 ? (
								<button
									type="button"
									aria-label="Remove pattern"
									className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
									onClick={() =>
										onChange(patterns.filter((_, i) => i !== pi))
									}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							) : null}
						</div>
						<div>
							<label className={clinicLabelClass}>
								Grammar Pattern <span className="text-red-500">*</span>
							</label>
							<input
								value={pattern.pattern}
								onChange={(e) => update(pi, { pattern: e.target.value })}
								placeholder="e.g. present perfect"
								className={clinicInputClass}
							/>
						</div>
						<div>
							<label className={clinicLabelClass}>
								Example Sentence <span className="text-red-500">*</span>
							</label>
							<input
								value={pattern.exampleSentence}
								onChange={(e) =>
									update(pi, { exampleSentence: e.target.value })
								}
								placeholder="e.g. I have worked here for five years."
								className={clinicInputClass}
							/>
						</div>
						<div>
							<label className={clinicLabelClass}>Hint</label>
							<input
								value={pattern.hint ?? ''}
								onChange={(e) => update(pi, { hint: e.target.value })}
								placeholder="Optional hint for the learner"
								className={clinicInputClass}
							/>
						</div>
					</div>
				))}
				<button
					type="button"
					className={`${clinicAddOutlineBtnClass} w-full`}
					onClick={() => onChange([...patterns, emptyPattern()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Pattern
				</button>
			</div>
		</div>
	);
}
