'use client';

import { Users, Search, Loader2 } from 'lucide-react';
import type { ClinicLearnerOption } from './clinic-create.types';
import { learnerDisplayName, learnerInitials } from './clinic-create-utils';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicInputClass,
	clinicSectionTitleClass,
	clinicHelperClass,
} from './clinic-create-styles';

type Props = {
	learners: ClinicLearnerOption[];
	loading: boolean;
	selectedIds: string[];
	search: string;
	onSearchChange: (value: string) => void;
	onToggle: (id: string) => void;
	onToggleAllFiltered: () => void;
};

const AVATAR_COLORS = [
	'bg-emerald-100 text-emerald-700',
	'bg-sky-100 text-sky-700',
	'bg-amber-100 text-amber-800',
	'bg-violet-100 text-violet-700',
	'bg-rose-100 text-rose-700',
];

export function ClinicUserAssignmentPanel({
	learners,
	loading,
	selectedIds,
	search,
	onSearchChange,
	onToggle,
	onToggleAllFiltered,
}: Props) {
	const q = search.trim().toLowerCase();
	const filtered = q
		? learners.filter((u) => {
				const name = learnerDisplayName(u).toLowerCase();
				const email = (u.email || '').toLowerCase();
				return name.includes(q) || email.includes(q);
			})
		: learners;

	const allFilteredSelected =
		filtered.length > 0 &&
		filtered.every((u) => selectedIds.includes(String(u._id)));

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-[#418b43] dark:bg-emerald-950/40 dark:text-primary-300">
						<Users className="h-4 w-4" />
					</div>
					<p className={clinicSectionTitleClass}>User Assignment</p>
				</div>
			</div>
			<div className={clinicCardBodyClass}>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-students">
						Students <span className="text-red-500">*</span>
					</label>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							id="clinic-students"
							type="search"
							value={search}
							onChange={(e) => onSearchChange(e.target.value)}
							placeholder="Search students…"
							className={`${clinicInputClass} pl-10`}
						/>
					</div>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
					</div>
				) : learners.length === 0 ? (
					<p className={`${clinicHelperClass} py-6 text-center`}>No users found</p>
				) : filtered.length === 0 ? (
					<p className={`${clinicHelperClass} py-6 text-center`}>
						No students match your search.
					</p>
				) : (
					<div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/80 p-2 dark:border-border dark:bg-muted/20">
						<label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white dark:hover:bg-card">
							<input
								type="checkbox"
								checked={allFilteredSelected}
								onChange={onToggleAllFiltered}
								className="h-4 w-4 rounded accent-[#418b43]"
							/>
							<span className="text-sm font-medium text-gray-700 dark:text-foreground">
								{q
									? `Select all shown (${filtered.length})`
									: 'Select all students'}
							</span>
						</label>
						{filtered.map((user, i) => {
							const id = String(user._id);
							const name = learnerDisplayName(user);
							const selected = selectedIds.includes(id);
							const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
							return (
								<label
									key={id}
									className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white dark:hover:bg-card ${
										selected ? '' : 'opacity-70'
									}`}
								>
									<input
										type="checkbox"
										checked={selected}
										onChange={() => onToggle(id)}
										className="h-4 w-4 rounded accent-[#418b43]"
									/>
									<span
										className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}
									>
										{learnerInitials(name)}
									</span>
									<span className="min-w-0">
										<span className="block truncate text-sm font-bold text-gray-900 dark:text-foreground">
											{name}
										</span>
										<span className="block truncate text-xs text-gray-400">
											{user.email}
										</span>
									</span>
								</label>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
