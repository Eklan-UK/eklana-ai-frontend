'use client';

import { MessageSquareText, Plus, Trash2 } from 'lucide-react';
import type { ClinicKeyPhraseQuestion } from '@/hooks/usePrecisionClinic';
import { emptyQuestion } from './clinic-create-utils';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicInputClass,
	clinicSelectClass,
	clinicSectionTitleClass,
	clinicHelperClass,
	clinicAddOutlineBtnClass,
} from './clinic-create-styles';

type Props = {
	questions: ClinicKeyPhraseQuestion[];
	onChange: (questions: ClinicKeyPhraseQuestion[]) => void;
};

export function ClinicKeyPhrasesPanel({ questions, onChange }: Props) {
	const update = (index: number, patch: Partial<ClinicKeyPhraseQuestion>) => {
		onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
						<MessageSquareText className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Questions <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Add multiple-choice questions with prompts and correct answers.
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicAddOutlineBtnClass}
					onClick={() => onChange([...questions, emptyQuestion()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Question
				</button>
			</div>
			<div className={`${clinicCardBodyClass} space-y-5`}>
				{questions.map((q, qi) => {
					const options = q.options.length >= 2 ? q.options : ['', ''];
					return (
						<div
							key={qi}
							className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-border dark:bg-muted/20"
						>
							<div className="flex items-center justify-between">
								<p className="text-sm font-extrabold text-gray-900 dark:text-foreground">
									Question {qi + 1}
								</p>
								{questions.length > 1 ? (
									<button
										type="button"
										aria-label="Remove question"
										className="rounded-full p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
										onClick={() =>
											onChange(questions.filter((_, i) => i !== qi))
										}
									>
										<Trash2 className="h-4 w-4" />
									</button>
								) : null}
							</div>
							<div>
								<label className={clinicLabelClass}>
									Respondent Name{' '}
									<span className="font-normal">(Optional)</span>
								</label>
								<input
									value={q.respondentName ?? ''}
									onChange={(e) =>
										update(qi, { respondentName: e.target.value })
									}
									placeholder="e.g. Nurse, Doctor, Patient"
									className={clinicInputClass}
								/>
							</div>
							<div>
								<label className={clinicLabelClass}>
									Prompt / Situation <span className="text-red-500">*</span>
								</label>
								<input
									value={q.prompt}
									onChange={(e) => update(qi, { prompt: e.target.value })}
									placeholder="e.g. A patient says they are in pain. What do you say?"
									className={clinicInputClass}
								/>
							</div>
							<div className="space-y-2">
								<label className={clinicLabelClass}>
									Options <span className="text-red-500">*</span>{' '}
									<span className="font-normal">(min. 2)</span>
								</label>
								{options.map((opt, oi) => (
									<div key={oi} className="flex items-center gap-2">
										<input
											value={opt}
											onChange={(e) => {
												const next = [...options];
												next[oi] = e.target.value;
												update(qi, { options: next });
											}}
											placeholder={`Option ${oi + 1}`}
											className={clinicInputClass}
										/>
										{options.length > 2 ? (
											<button
												type="button"
												aria-label="Remove option"
												className="rounded-full p-2 text-red-500 hover:bg-red-50"
												onClick={() => {
													const next = options.filter((_, i) => i !== oi);
													const patch: Partial<ClinicKeyPhraseQuestion> = {
														options: next,
													};
													if (q.correctAnswer === opt) {
														patch.correctAnswer = '';
													}
													update(qi, patch);
												}}
											>
												<Trash2 className="h-4 w-4" />
											</button>
										) : null}
									</div>
								))}
								<button
									type="button"
									className={clinicAddOutlineBtnClass}
									onClick={() => update(qi, { options: [...options, ''] })}
								>
									<Plus className="h-3.5 w-3.5" />
									Add Option
								</button>
							</div>
							<div>
								<label className={clinicLabelClass}>
									Correct Answer <span className="text-red-500">*</span>
								</label>
								<select
									value={q.correctAnswer}
									onChange={(e) =>
										update(qi, { correctAnswer: e.target.value })
									}
									className={clinicSelectClass}
								>
									<option value="">Select correct option</option>
									{options
										.filter((o) => o.trim())
										.map((o) => (
											<option key={o} value={o}>
												{o}
											</option>
										))}
								</select>
							</div>
						</div>
					);
				})}
				<button
					type="button"
					className={`${clinicAddOutlineBtnClass} w-full`}
					onClick={() => onChange([...questions, emptyQuestion()])}
				>
					<Plus className="h-3.5 w-3.5" />
					Add Question
				</button>
			</div>
		</div>
	);
}
