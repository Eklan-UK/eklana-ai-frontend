'use client';

import { useMemo, useState } from 'react';
import {
	X,
	Sparkles,
	Loader2,
	Search,
	ChevronDown,
} from 'lucide-react';
import {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
	PRECISION_CLINIC_DIFFICULTIES,
	type PrecisionClinicDrillType,
	type PrecisionClinicDifficulty,
} from '@/hooks/usePrecisionClinic';
import type { ClinicAiModalState, ClinicLearnerOption } from './clinic-create.types';
import { learnerDisplayName, learnerInitials } from './clinic-create-utils';
import {
	clinicLabelClass,
	clinicInputClass,
	clinicSelectClass,
	clinicTextareaClass,
	clinicSectionTitleClass,
	clinicHelperClass,
	clinicPrimaryBtnClass,
	clinicGhostBtnClass,
} from './clinic-create-styles';

type Props = {
	open: boolean;
	onClose: () => void;
	values: ClinicAiModalState;
	onChange: (patch: Partial<ClinicAiModalState>) => void;
	learners: ClinicLearnerOption[];
	loadingLearners?: boolean;
	isGenerating?: boolean;
	onGenerate: () => void;
};

export function ClinicGenerateAIModal({
	open,
	onClose,
	values,
	onChange,
	learners,
	loadingLearners = false,
	isGenerating = false,
	onGenerate,
}: Props) {
	const [studentSearch, setStudentSearch] = useState('');

	const filtered = useMemo(() => {
		const q = studentSearch.trim().toLowerCase();
		if (!q) return learners;
		return learners.filter((u) => {
			const name = learnerDisplayName(u).toLowerCase();
			const email = (u.email || '').toLowerCase();
			return name.includes(q) || email.includes(q);
		});
	}, [learners, studentSearch]);

	if (!open) return null;

	const toggleStudent = (id: string) => {
		const set = new Set(values.studentIds);
		if (set.has(id)) set.delete(id);
		else set.add(id);
		onChange({ studentIds: Array.from(set) });
	};

	const toggleType = (type: PrecisionClinicDrillType) => {
		const set = new Set(values.drillTypes);
		if (set.has(type)) {
			if (set.size === 1) return;
			set.delete(type);
		} else {
			set.add(type);
		}
		onChange({ drillTypes: Array.from(set) });
	};

	const canGenerate =
		values.studentIds.length > 0 &&
		values.drillTypes.length > 0 &&
		values.prompt.trim().length > 0 &&
		values.context.trim().length > 0 &&
		!isGenerating;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
			<div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-border dark:bg-card">
				<div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-border">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-[#418b43]" />
						<p className={clinicSectionTitleClass}>Generate Drill with AI</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
					<div>
						<label className={clinicLabelClass}>
							Students <span className="text-red-500">*</span>
						</label>
						<div className="relative mb-2">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							<input
								type="search"
								value={studentSearch}
								onChange={(e) => setStudentSearch(e.target.value)}
								placeholder="Search students…"
								className={`${clinicInputClass} pl-10`}
							/>
						</div>
						{loadingLearners ? (
							<div className="flex justify-center py-6">
								<Loader2 className="h-5 w-5 animate-spin text-gray-400" />
							</div>
						) : (
							<div className="max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2 dark:border-border dark:bg-muted/20">
								{filtered.map((user) => {
									const id = String(user._id);
									const name = learnerDisplayName(user);
									const selected = values.studentIds.includes(id);
									return (
										<label
											key={id}
											className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white dark:hover:bg-card"
										>
											<input
												type="checkbox"
												checked={selected}
												onChange={() => toggleStudent(id)}
												className="h-4 w-4 rounded accent-[#418b43]"
											/>
											<span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
												{learnerInitials(name)}
											</span>
											<span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-foreground">
												{name}
											</span>
										</label>
									);
								})}
							</div>
						)}
					</div>

					<div>
						<label className={clinicLabelClass} htmlFor="ai-title">
							Drill Title <span className="text-red-500">*</span>
						</label>
						<input
							id="ai-title"
							value={values.title}
							onChange={(e) => onChange({ title: e.target.value })}
							placeholder="Optional title for generated drill"
							className={clinicInputClass}
						/>
					</div>

					<div>
						<label className={clinicLabelClass}>
							Drill Types <span className="text-red-500">*</span>
						</label>
						<div className="flex flex-wrap gap-2">
							{PRECISION_CLINIC_DRILL_TYPES.map((type) => {
								const active = values.drillTypes.includes(type);
								return (
									<button
										key={type}
										type="button"
										onClick={() => toggleType(type)}
										className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
											active
												? 'border-[#418b43] bg-[#418b43] text-white'
												: 'border-gray-200 bg-white text-gray-700 hover:border-[#418b43]/40 dark:border-border dark:bg-card dark:text-foreground'
										}`}
									>
										{PRECISION_CLINIC_DRILL_TYPE_LABELS[type]}
									</button>
								);
							})}
						</div>
					</div>

					<div className="relative">
						<label className={clinicLabelClass} htmlFor="ai-difficulty">
							Difficulty <span className="text-red-500">*</span>
						</label>
						<select
							id="ai-difficulty"
							value={values.difficulty}
							onChange={(e) =>
								onChange({
									difficulty: e.target.value as PrecisionClinicDifficulty,
								})
							}
							className={clinicSelectClass}
						>
							{PRECISION_CLINIC_DIFFICULTIES.map((d) => (
								<option key={d} value={d}>
									{d.charAt(0).toUpperCase() + d.slice(1)}
								</option>
							))}
						</select>
						<ChevronDown className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-gray-400" />
					</div>

					<div>
						<label className={clinicLabelClass} htmlFor="ai-context">
							Context / Scenario <span className="text-red-500">*</span>
						</label>
						<textarea
							id="ai-context"
							value={values.context}
							onChange={(e) => onChange({ context: e.target.value })}
							placeholder="e.g. Ward handover with a confused elderly patient"
							className={clinicTextareaClass}
						/>
					</div>

					<div>
						<label className={clinicLabelClass} htmlFor="ai-prompt">
							Prompt <span className="text-red-500">*</span>
						</label>
						<textarea
							id="ai-prompt"
							value={values.prompt}
							onChange={(e) => onChange({ prompt: e.target.value })}
							placeholder="Describe what you want the AI to generate…"
							className={`${clinicTextareaClass} min-h-[120px]`}
						/>
						<p className={`${clinicHelperClass} mt-1`}>
							Be specific about clinical focus, vocabulary, or learner needs.
						</p>
					</div>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-border">
					<button type="button" className={clinicGhostBtnClass} onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						disabled={!canGenerate}
						className={clinicPrimaryBtnClass}
						onClick={onGenerate}
					>
						{isGenerating ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Generating…
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" />
								Generate with AI
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
