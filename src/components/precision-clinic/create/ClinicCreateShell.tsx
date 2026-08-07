'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
	ArrowLeft,
	Sparkles,
	Save,
	UserPlus,
	Copy,
	X,
	Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '@/services/admin.service';
import {
	useCreatePrecisionClinic,
	useUpdatePrecisionClinic,
	usePrecisionClinicDetail,
	useAiGeneratePrecisionClinic,
	useDuplicatePrecisionClinic,
	type PrecisionClinicDrillType,
} from '@/hooks/usePrecisionClinic';
import type {
	ClinicCreateFormState,
	ClinicAiModalState,
	ClinicLearnerOption,
} from './clinic-create.types';
import {
	getDefaultClinicForm,
	getDefaultAiModalState,
	formFromClinicDrill,
	applyAiContentToForm,
	buildCreatePayload,
	validateClinicForm,
	CLINIC_TYPE_SUBTITLES,
} from './clinic-create-utils';
import {
	clinicPrimaryBtnClass,
	clinicOutlineBtnClass,
	clinicGhostBtnClass,
} from './clinic-create-styles';
import { ClinicImportContentCard } from './ClinicImportContentCard';
import { ClinicDrillSettingsPanel } from './ClinicDrillSettingsPanel';
import { ClinicAudioSettingsPanel } from './ClinicAudioSettingsPanel';
import { ClinicUserAssignmentPanel } from './ClinicUserAssignmentPanel';
import { ClinicGenerateAIModal } from './ClinicGenerateAIModal';
import { ClinicPronunciationPanel } from './ClinicPronunciationPanel';
import { ClinicKeyPhrasesPanel } from './ClinicKeyPhrasesPanel';
import { ClinicMatchingPanel } from './ClinicMatchingPanel';
import { ClinicGrammarPanel } from './ClinicGrammarPanel';
import { ClinicSentenceWritingPanel } from './ClinicSentenceWritingPanel';
import { ClinicListeningPanel } from './ClinicListeningPanel';
import { ClinicSummaryPanel } from './ClinicSummaryPanel';

const LIST_PATH = '/admin/precision-clinic';

export function ClinicCreateShell() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get('id') || undefined;

	const [form, setForm] = useState<ClinicCreateFormState>(() =>
		getDefaultClinicForm()
	);
	const [learners, setLearners] = useState<ClinicLearnerOption[]>([]);
	const [loadingLearners, setLoadingLearners] = useState(true);
	const [studentSearch, setStudentSearch] = useState('');
	const [aiOpen, setAiOpen] = useState(false);
	const [aiValues, setAiValues] = useState<ClinicAiModalState>(() =>
		getDefaultAiModalState(getDefaultClinicForm())
	);
	const [hydratedEdit, setHydratedEdit] = useState(false);
	const [savingMode, setSavingMode] = useState<'draft' | 'assign' | null>(
		null
	);

	const detailQuery = usePrecisionClinicDetail(editId, {
		enabled: Boolean(editId),
	});
	const createMutation = useCreatePrecisionClinic();
	const updateMutation = useUpdatePrecisionClinic();
	const aiMutation = useAiGeneratePrecisionClinic();
	const duplicateMutation = useDuplicatePrecisionClinic();

	const patchForm = (patch: Partial<ClinicCreateFormState>) => {
		setForm((prev) => ({ ...prev, ...patch }));
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				setLoadingLearners(true);
				const response = await adminService.getLearners({ limit: 1000 });
				if (!cancelled) {
					setLearners(response.data?.learners ?? []);
				}
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : 'Unknown error';
				toast.error('Failed to load users: ' + message);
			} finally {
				if (!cancelled) setLoadingLearners(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!editId || hydratedEdit || !detailQuery.data) return;
		const next = formFromClinicDrill(detailQuery.data as Record<string, unknown>);
		setForm(next);
		setAiValues(getDefaultAiModalState(next));
		setHydratedEdit(true);
	}, [editId, detailQuery.data, hydratedEdit]);

	const busy =
		createMutation.isPending ||
		updateMutation.isPending ||
		duplicateMutation.isPending ||
		savingMode !== null;

	const typePanel = useMemo(() => {
		switch (form.type) {
			case 'pronunciation':
				return (
					<ClinicPronunciationPanel
						soundGroups={form.soundGroups}
						onChange={(soundGroups) => patchForm({ soundGroups })}
					/>
				);
			case 'key_phrases':
				return (
					<ClinicKeyPhrasesPanel
						questions={form.questions}
						onChange={(questions) => patchForm({ questions })}
					/>
				);
			case 'matching':
				return (
					<ClinicMatchingPanel
						pairs={form.pairs}
						onChange={(pairs) => patchForm({ pairs })}
					/>
				);
			case 'grammar':
				return (
					<ClinicGrammarPanel
						patterns={form.patterns}
						onChange={(patterns) => patchForm({ patterns })}
					/>
				);
			case 'sentence_writing':
				return (
					<ClinicSentenceWritingPanel
						words={form.words}
						onChange={(words) => patchForm({ words })}
					/>
				);
			case 'listening':
				return (
					<ClinicListeningPanel
						contentTitle={form.contentTitle}
						content={form.content || form.importedText}
						onChange={(patch) => patchForm(patch)}
					/>
				);
			case 'summary':
				return (
					<ClinicSummaryPanel
						articleTitle={form.articleTitle}
						articleContent={form.articleContent || form.importedText}
						onChange={(patch) => patchForm(patch)}
					/>
				);
			default:
				return null;
		}
	}, [form]);

	const persist = async (requireAssignment: boolean) => {
		const error = validateClinicForm(form, { requireAssignment });
		if (error) {
			toast.error(error);
			return;
		}
		const payload = buildCreatePayload(form, { requireAssignment });
		if (requireAssignment) {
			payload.assignedLearnerIds = form.assignedLearnerIds;
		} else if (!editId) {
			// Draft create: allow empty assignment
			payload.assignedLearnerIds = form.assignedLearnerIds;
		}

		setSavingMode(requireAssignment ? 'assign' : 'draft');
		try {
			if (editId) {
				await updateMutation.mutateAsync({ id: editId, data: payload });
			} else {
				const created = await createMutation.mutateAsync(payload);
				const newId = String(created?._id ?? created?.id ?? '');
				if (newId) {
					router.replace(`${LIST_PATH}/create?id=${newId}`);
				}
			}
			router.push(LIST_PATH);
		} catch {
			// toast handled by mutation
		} finally {
			setSavingMode(null);
		}
	};

	const handleCopy = async () => {
		if (editId) {
			try {
				const dup = await duplicateMutation.mutateAsync(editId);
				const newId = String(dup?._id ?? dup?.id ?? '');
				toast.success('Drill copied');
				if (newId) {
					router.push(`${LIST_PATH}/create?id=${newId}`);
					setHydratedEdit(false);
				}
			} catch {
				// toast from mutation
			}
			return;
		}
		const copy = {
			...form,
			title: form.title ? `${form.title} (Copy)` : '',
			assignedLearnerIds: [],
		};
		setForm(copy);
		toast.success('Drill copied. Select students, then Save & Assign.');
	};

	const handleAiGenerate = async () => {
		if (aiValues.studentIds.length === 0) {
			toast.error('Select at least one student');
			return;
		}
		if (!aiValues.prompt.trim() || !aiValues.context.trim()) {
			toast.error('Context and prompt are required');
			return;
		}
		try {
			const result = await aiMutation.mutateAsync({
				studentIds: aiValues.studentIds,
				title: aiValues.title || undefined,
				drillTypes: aiValues.drillTypes,
				difficulty: aiValues.difficulty,
				context: aiValues.context,
				prompt: aiValues.prompt,
			});

			const items = Array.isArray(result)
				? result
				: Array.isArray((result as { items?: unknown })?.items)
					? (result as { items: unknown[] }).items
					: result
						? [result]
						: [];

			const first = items[0] as
				| {
						drillType?: string;
						title?: string;
						content?: Record<string, unknown>;
				  }
				| undefined;

			if (!first) {
				toast.error('AI returned no content');
				return;
			}

			const next = applyAiContentToForm(form, first);
			if (aiValues.title.trim()) next.title = aiValues.title.trim();
			if (aiValues.studentIds.length) {
				next.assignedLearnerIds = aiValues.studentIds;
			}
			next.difficulty = aiValues.difficulty;
			next.context = aiValues.context;
			setForm(next);
			setAiOpen(false);
			toast.success('AI content applied to the form');
		} catch {
			// toast from mutation
		}
	};

	if (editId && detailQuery.isLoading && !hydratedEdit) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[#418b43]" />
			</div>
		);
	}

	return (
		<div className="relative flex min-h-[calc(100vh-2rem)] flex-col pb-24">
			{/* Header */}
			<div className="flex flex-col gap-4 border-b border-gray-200 bg-white px-6 py-4 dark:border-border dark:bg-card sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<button
						type="button"
						onClick={() => router.push(LIST_PATH)}
						className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
						aria-label="Back to Precision Clinic"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
					<div>
						<h1 className="text-lg font-extrabold text-gray-900 dark:text-foreground">
							{editId ? 'Edit Precision Clinic Drill' : 'Create Precision Clinic Drill'}
						</h1>
						<p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-muted-foreground">
							{CLINIC_TYPE_SUBTITLES[form.type]}
						</p>
					</div>
				</div>
				<button
					type="button"
					className={clinicPrimaryBtnClass}
					onClick={() => {
						setAiValues(getDefaultAiModalState(form));
						setAiOpen(true);
					}}
				>
					<Sparkles className="h-4 w-4" />
					Generate with AI
				</button>
			</div>

			{/* Body */}
			<div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] lg:px-8">
				<div className="space-y-5">
					<ClinicImportContentCard
						drillType={form.type}
						importedText={form.importedText}
						onImportedTextChange={(importedText) => {
							const patch: Partial<ClinicCreateFormState> = { importedText };
							if (form.type === 'listening' && !form.content.trim()) {
								patch.content = importedText;
							}
							if (form.type === 'summary' && !form.articleContent.trim()) {
								patch.articleContent = importedText;
							}
							if (
								(form.type === 'listening' || form.type === 'summary') === false &&
								!form.context.trim()
							) {
								patch.context = importedText.slice(0, 2000);
							}
							patchForm(patch);
						}}
					/>
					{typePanel}
				</div>

				<div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
					<ClinicDrillSettingsPanel
						title={form.title}
						completionDate={form.completionDate}
						durationDays={form.durationDays}
						type={form.type}
						difficulty={form.difficulty}
						context={form.context}
						onChange={(patch) => {
							if (patch.type && patch.type !== form.type) {
								patchForm({
									...patch,
									type: patch.type as PrecisionClinicDrillType,
								});
							} else {
								patchForm(patch);
							}
						}}
					/>
					<ClinicAudioSettingsPanel
						preGenerateAudio={form.preGenerateAudio}
						ttsVoiceKey={form.ttsVoiceKey}
						onChange={patchForm}
					/>
					<ClinicUserAssignmentPanel
						learners={learners}
						loading={loadingLearners}
						selectedIds={form.assignedLearnerIds}
						search={studentSearch}
						onSearchChange={setStudentSearch}
						onToggle={(id) => {
							setForm((prev) => {
								const set = new Set(prev.assignedLearnerIds);
								if (set.has(id)) set.delete(id);
								else set.add(id);
								return { ...prev, assignedLearnerIds: Array.from(set) };
							});
						}}
						onToggleAllFiltered={() => {
							const q = studentSearch.trim().toLowerCase();
							const filtered = q
								? learners.filter((u) => {
										const name =
											`${u.firstName || ''} ${u.lastName || ''} ${u.name || ''} ${u.email || ''}`.toLowerCase();
										return name.includes(q);
									})
								: learners;
							const ids = filtered.map((u) => String(u._id));
							const allSelected = ids.every((id) =>
								form.assignedLearnerIds.includes(id)
							);
							setForm((prev) => {
								if (allSelected) {
									const drop = new Set(ids);
									return {
										...prev,
										assignedLearnerIds: prev.assignedLearnerIds.filter(
											(id) => !drop.has(id)
										),
									};
								}
								return {
									...prev,
									assignedLearnerIds: Array.from(
										new Set([...prev.assignedLearnerIds, ...ids])
									),
								};
							});
						}}
					/>
				</div>
			</div>

			{/* Sticky footer */}
			<div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur dark:border-border dark:bg-card/95 md:left-[240px]">
				<div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-2 px-4 py-3 lg:px-8">
					<button
						type="button"
						disabled={busy}
						className={clinicPrimaryBtnClass}
						onClick={() => void persist(false)}
					>
						{savingMode === 'draft' ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						Save Draft
					</button>
					<button
						type="button"
						disabled={busy}
						className={clinicOutlineBtnClass}
						onClick={() => void persist(true)}
					>
						{savingMode === 'assign' ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<UserPlus className="h-4 w-4" />
						)}
						Save & Assign
					</button>
					<button
						type="button"
						disabled={busy}
						className={clinicGhostBtnClass}
						onClick={() => void handleCopy()}
					>
						<Copy className="h-4 w-4" />
						Copy Drill
					</button>
					<button
						type="button"
						disabled={busy}
						className={clinicGhostBtnClass}
						onClick={() => router.push(LIST_PATH)}
					>
						<X className="h-4 w-4" />
						Cancel
					</button>
				</div>
			</div>

			<ClinicGenerateAIModal
				open={aiOpen}
				onClose={() => setAiOpen(false)}
				values={aiValues}
				onChange={(patch) => setAiValues((prev) => ({ ...prev, ...patch }))}
				learners={learners}
				loadingLearners={loadingLearners}
				isGenerating={aiMutation.isPending}
				onGenerate={() => void handleAiGenerate()}
			/>
		</div>
	);
}
