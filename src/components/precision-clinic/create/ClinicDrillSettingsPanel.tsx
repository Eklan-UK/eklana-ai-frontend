'use client';

import { Settings, ChevronDown } from 'lucide-react';
import {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
	PRECISION_CLINIC_DIFFICULTIES,
	type PrecisionClinicDrillType,
	type PrecisionClinicDifficulty,
} from '@/hooks/usePrecisionClinic';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicInputClass,
	clinicSelectClass,
	clinicTextareaClass,
	clinicSectionTitleClass,
} from './clinic-create-styles';

type Props = {
	title: string;
	completionDate: string;
	durationDays: number;
	type: PrecisionClinicDrillType;
	difficulty: PrecisionClinicDifficulty;
	context: string;
	onChange: (patch: {
		title?: string;
		completionDate?: string;
		durationDays?: number;
		type?: PrecisionClinicDrillType;
		difficulty?: PrecisionClinicDifficulty;
		context?: string;
	}) => void;
};

export function ClinicDrillSettingsPanel({
	title,
	completionDate,
	durationDays,
	type,
	difficulty,
	context,
	onChange,
}: Props) {
	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground">
						<Settings className="h-4 w-4" />
					</div>
					<p className={clinicSectionTitleClass}>Drill Settings</p>
				</div>
			</div>
			<div className={clinicCardBodyClass}>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-title">
						Drill Title (optional)
					</label>
					<input
						id="clinic-title"
						value={title}
						onChange={(e) => onChange({ title: e.target.value })}
						placeholder="e.g. R/L contrast — ward handover"
						className={clinicInputClass}
					/>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className={clinicLabelClass} htmlFor="clinic-completion">
							Completion Date
						</label>
						<input
							id="clinic-completion"
							type="date"
							value={completionDate}
							onChange={(e) => onChange({ completionDate: e.target.value })}
							className={clinicInputClass}
						/>
					</div>
					<div>
						<label className={clinicLabelClass} htmlFor="clinic-duration">
							Duration (days)
						</label>
						<input
							id="clinic-duration"
							type="number"
							min={1}
							value={durationDays}
							onChange={(e) =>
								onChange({ durationDays: Math.max(1, Number(e.target.value) || 1) })
							}
							className={clinicInputClass}
						/>
					</div>
				</div>

				<div className="relative">
					<label className={clinicLabelClass} htmlFor="clinic-type">
						Drill type <span className="text-red-500">*</span>
					</label>
					<select
						id="clinic-type"
						value={type}
						onChange={(e) =>
							onChange({ type: e.target.value as PrecisionClinicDrillType })
						}
						className={clinicSelectClass}
					>
						{PRECISION_CLINIC_DRILL_TYPES.map((t) => (
							<option key={t} value={t}>
								{PRECISION_CLINIC_DRILL_TYPE_LABELS[t]}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-gray-400" />
				</div>

				<div className="relative">
					<label className={clinicLabelClass} htmlFor="clinic-difficulty">
						Difficulty <span className="text-red-500">*</span>
					</label>
					<select
						id="clinic-difficulty"
						value={difficulty}
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
					<label className={clinicLabelClass} htmlFor="clinic-context">
						Context (Optional)
					</label>
					<textarea
						id="clinic-context"
						value={context}
						onChange={(e) => onChange({ context: e.target.value })}
						placeholder="Additional context or scenario notes"
						className={clinicTextareaClass}
					/>
				</div>
			</div>
		</div>
	);
}
