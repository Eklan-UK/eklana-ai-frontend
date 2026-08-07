'use client';

import { PencilLine, Plus, Trash2 } from 'lucide-react';
import type { ClinicSentenceWritingWord } from '@/hooks/usePrecisionClinic';
import { emptyWord } from './clinic-create-utils';
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
	words: ClinicSentenceWritingWord[];
	onChange: (words: ClinicSentenceWritingWord[]) => void;
};

export function ClinicSentenceWritingPanel({ words, onChange }: Props) {
	const update = (index: number, patch: Partial<ClinicSentenceWritingWord>) => {
		onChange(words.map((w, i) => (i === index ? { ...w, ...patch } : w)));
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
						<PencilLine className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Words for Sentence Writing <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Provide words or expressions for students to write sentences with.
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicAddOutlineBtnClass}
					onClick={() => onChange([...words, emptyWord()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Word
				</button>
			</div>
			<div className={`${clinicCardBodyClass} space-y-4`}>
				{words.map((word, wi) => (
					<div
						key={wi}
						className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-border dark:bg-muted/20"
					>
						<div className="flex items-center justify-between">
							<p className="text-sm font-extrabold text-gray-900 dark:text-foreground">
								Word {wi + 1}
							</p>
							{words.length > 1 ? (
								<button
									type="button"
									aria-label="Remove word"
									className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
									onClick={() => onChange(words.filter((_, i) => i !== wi))}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							) : null}
						</div>
						<div>
							<label className={clinicLabelClass}>
								Word / Expression <span className="text-red-500">*</span>
							</label>
							<input
								value={word.word}
								onChange={(e) => update(wi, { word: e.target.value })}
								placeholder="e.g. assess"
								className={clinicInputClass}
							/>
						</div>
						<div>
							<label className={clinicLabelClass}>Hint</label>
							<input
								value={word.hint ?? ''}
								onChange={(e) => update(wi, { hint: e.target.value })}
								placeholder="Optional hint"
								className={clinicInputClass}
							/>
						</div>
					</div>
				))}
				<button
					type="button"
					className={`${clinicAddOutlineBtnClass} w-full`}
					onClick={() => onChange([...words, emptyWord()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Word
				</button>
			</div>
		</div>
	);
}
