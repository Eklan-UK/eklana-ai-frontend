'use client';

import { useRef, useState } from 'react';
import {
	Upload,
	ClipboardPaste,
	Download,
	ChevronDown,
	X,
	Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PrecisionClinicDrillType } from '@/hooks/usePrecisionClinic';
import { downloadClinicTemplate } from './clinic-create-utils';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicSectionTitleClass,
	clinicHelperClass,
	clinicAddOutlineBtnClass,
	clinicTextareaClass,
	clinicPrimaryBtnClass,
	clinicGhostBtnClass,
} from './clinic-create-styles';

type Props = {
	drillType: PrecisionClinicDrillType;
	importedText: string;
	onImportedTextChange: (text: string) => void;
};

const ACCEPT =
	'.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,application/pdf,text/plain,text/csv,text/markdown';

export function ClinicImportContentCard({
	drillType,
	importedText,
	onImportedTextChange,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [pasteOpen, setPasteOpen] = useState(false);
	const [pasteDraft, setPasteDraft] = useState('');
	const [reading, setReading] = useState(false);

	const readFile = async (file: File) => {
		if (file.size > 10 * 1024 * 1024) {
			toast.error('File must be 10MB or smaller');
			return;
		}
		setReading(true);
		try {
			const text = await file.text();
			onImportedTextChange(text);
			toast.success(`Imported “${file.name}”`);
		} catch {
			toast.error('Could not read that file. Try CSV, Text, or Markdown.');
		} finally {
			setReading(false);
		}
	};

	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div>
					<p className={clinicSectionTitleClass}>Import Content</p>
					<p className={`${clinicHelperClass} mt-0.5`}>
						Upload a file or paste copied text to get started.
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						downloadClinicTemplate(drillType);
						toast.success('Template downloaded');
					}}
					className={clinicAddOutlineBtnClass}
				>
					<Download className="h-4 w-4" />
					Download Template
					<ChevronDown className="h-3 w-3 opacity-60" />
				</button>
			</div>
			<div className={clinicCardBodyClass}>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					onDragEnter={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragOver={(e) => e.preventDefault()}
					onDragLeave={() => setDragging(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragging(false);
						const file = e.dataTransfer.files?.[0];
						if (file) void readFile(file);
					}}
					className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
						dragging
							? 'border-[#418b43] bg-[#418b43]/5'
							: 'border-gray-200 bg-gray-50/50 hover:border-[#418b43]/40 dark:border-border dark:bg-muted/30'
					}`}
				>
					{reading ? (
						<Loader2 className="h-8 w-8 animate-spin text-[#418b43]" />
					) : (
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#418b43]/10 text-[#418b43]">
							<Upload className="h-5 w-5" />
						</div>
					)}
					<p className="text-sm font-semibold text-gray-800 dark:text-foreground">
						Drag & drop your file here or click to browse
					</p>
					<p className={clinicHelperClass}>
						PDF, Word, Excel, CSV, Text, Markdown (Max 10MB)
					</p>
					<input
						ref={inputRef}
						type="file"
						accept={ACCEPT}
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void readFile(file);
							e.target.value = '';
						}}
					/>
				</button>

				<div className="flex items-center gap-3">
					<div className="h-px flex-1 bg-gray-200 dark:bg-border" />
					<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
						OR
					</span>
					<div className="h-px flex-1 bg-gray-200 dark:bg-border" />
				</div>

				<button
					type="button"
					onClick={() => {
						setPasteDraft(importedText);
						setPasteOpen(true);
					}}
					className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
				>
					<ClipboardPaste className="h-4 w-4 text-[#418b43]" />
					Paste copied text
				</button>

				{importedText.trim() ? (
					<p className={`${clinicHelperClass} line-clamp-2`}>
						Imported {importedText.trim().length.toLocaleString()} characters
						ready to apply.
					</p>
				) : null}
			</div>

			{pasteOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-border dark:bg-card">
						<div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-border">
							<p className={clinicSectionTitleClass}>Paste content</p>
							<button
								type="button"
								onClick={() => setPasteOpen(false)}
								className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-muted"
								aria-label="Close"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="space-y-4 px-5 py-4">
							<textarea
								value={pasteDraft}
								onChange={(e) => setPasteDraft(e.target.value)}
								placeholder="Paste your content here…"
								className={`${clinicTextareaClass} min-h-[180px]`}
							/>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									className={clinicGhostBtnClass}
									onClick={() => setPasteOpen(false)}
								>
									Cancel
								</button>
								<button
									type="button"
									className={clinicPrimaryBtnClass}
									onClick={() => {
										onImportedTextChange(pasteDraft);
										setPasteOpen(false);
										toast.success('Text pasted');
									}}
								>
									Apply
								</button>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
