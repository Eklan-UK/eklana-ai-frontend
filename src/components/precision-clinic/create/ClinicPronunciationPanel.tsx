'use client';

import { useState } from 'react';
import { Mic, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClinicSoundGroup } from '@/hooks/usePrecisionClinic';
import { emptySoundGroup } from './clinic-create-utils';
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
	soundGroups: ClinicSoundGroup[];
	onChange: (soundGroups: ClinicSoundGroup[]) => void;
};

export function ClinicPronunciationPanel({ soundGroups, onChange }: Props) {
	const [openIndexes, setOpenIndexes] = useState<Record<number, boolean>>({
		0: true,
	});

	const updateGroup = (index: number, patch: Partial<ClinicSoundGroup>) => {
		onChange(
			soundGroups.map((g, i) => (i === index ? { ...g, ...patch } : g))
		);
	};

	const updateWord = (
		gi: number,
		wi: number,
		patch: Partial<ClinicSoundGroup['words'][number]>
	) => {
		const group = soundGroups[gi];
		if (!group) return;
		const words = group.words.map((w, i) => (i === wi ? { ...w, ...patch } : w));
		updateGroup(gi, { words });
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
						<Mic className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Pronunciation Items <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Group words by target sound with practice sentences.
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicAddOutlineBtnClass}
					onClick={() => {
						const next = [...soundGroups, emptySoundGroup()];
						onChange(next);
						setOpenIndexes((prev) => ({ ...prev, [next.length - 1]: true }));
					}}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Sound Group
				</button>
			</div>
			<div className={`${clinicCardBodyClass} space-y-4`}>
				{soundGroups.map((group, gi) => {
					const open = openIndexes[gi] !== false;
					const wordCount = group.words.filter((w) => w.word.trim()).length;
					return (
						<div
							key={gi}
							className="rounded-2xl border border-gray-100 bg-gray-50/60 dark:border-border dark:bg-muted/20"
						>
							<button
								type="button"
								className="flex w-full items-center justify-between gap-3 px-4 py-3"
								onClick={() =>
									setOpenIndexes((prev) => ({ ...prev, [gi]: !open }))
								}
							>
								<div className="text-left">
									<p className="text-sm font-extrabold text-gray-900 dark:text-foreground">
										Sound Group {gi + 1}
									</p>
									<p className={clinicHelperClass}>
										{wordCount} word{wordCount === 1 ? '' : 's'}
									</p>
								</div>
								{open ? (
									<ChevronUp className="h-4 w-4 text-gray-400" />
								) : (
									<ChevronDown className="h-4 w-4 text-gray-400" />
								)}
							</button>
							{open ? (
								<div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-border">
									<div>
										<label className={clinicLabelClass}>Target Sound</label>
										<input
											value={group.targetSound}
											onChange={(e) =>
												updateGroup(gi, { targetSound: e.target.value })
											}
											placeholder="e.g. R / L, J, TH, SH"
											className={clinicInputClass}
										/>
									</div>
									<div className="space-y-2">
										<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
											<span>Word</span>
											<span>Practice Sentence</span>
											<span className="sr-only">Actions</span>
										</div>
										{group.words.map((word, wi) => (
											<div
												key={wi}
												className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_40px] items-center gap-2"
											>
												<input
													value={word.word}
													onChange={(e) =>
														updateWord(gi, wi, { word: e.target.value })
													}
													placeholder="e.g. priority"
													className={clinicInputClass}
												/>
												<input
													value={word.practiceSentence}
													onChange={(e) =>
														updateWord(gi, wi, {
															practiceSentence: e.target.value,
														})
													}
													placeholder="e.g. My priority is to improve my English this year."
													className={clinicInputClass}
												/>
												<button
													type="button"
													aria-label="Remove word"
													className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
													onClick={() => {
														const words = group.words.filter((_, i) => i !== wi);
														updateGroup(gi, {
															words:
																words.length > 0
																	? words
																	: [{ word: '', practiceSentence: '' }],
														});
													}}
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										))}
										<button
											type="button"
											className={clinicAddOutlineBtnClass}
											onClick={() =>
												updateGroup(gi, {
													words: [
														...group.words,
														{ word: '', practiceSentence: '' },
													],
												})
											}
										>
											<Plus className="h-3.5 w-3.5" />
											Add Word
										</button>
									</div>
									{soundGroups.length > 1 ? (
										<button
											type="button"
											className="text-xs font-semibold text-red-500 hover:underline"
											onClick={() =>
												onChange(soundGroups.filter((_, i) => i !== gi))
											}
										>
											Remove sound group
										</button>
									) : null}
								</div>
							) : null}
						</div>
					);
				})}
				<button
					type="button"
					className={`${clinicAddOutlineBtnClass} w-full`}
					onClick={() => {
						const next = [...soundGroups, emptySoundGroup()];
						onChange(next);
						setOpenIndexes((prev) => ({ ...prev, [next.length - 1]: true }));
					}}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Sound Group
				</button>
			</div>
		</div>
	);
}
