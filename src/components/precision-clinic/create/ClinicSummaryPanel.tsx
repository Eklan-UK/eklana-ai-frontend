'use client';

import { FileText } from 'lucide-react';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicInputClass,
	clinicTextareaClass,
	clinicSectionTitleClass,
	clinicHelperClass,
} from './clinic-create-styles';

type Props = {
	articleTitle: string;
	articleContent: string;
	onChange: (patch: { articleTitle?: string; articleContent?: string }) => void;
};

export function ClinicSummaryPanel({
	articleTitle,
	articleContent,
	onChange,
}: Props) {
	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
						<FileText className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Article for Summary <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Provide an article for students to read and summarise.
						</p>
					</div>
				</div>
			</div>
			<div className={clinicCardBodyClass}>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-article-title">
						Article Title
					</label>
					<input
						id="clinic-article-title"
						value={articleTitle}
						onChange={(e) => onChange({ articleTitle: e.target.value })}
						placeholder="e.g. Patient Education: Hand Hygiene"
						className={clinicInputClass}
					/>
				</div>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-article-content">
						Article Content <span className="text-red-500">*</span>
					</label>
					<textarea
						id="clinic-article-content"
						value={articleContent}
						onChange={(e) => onChange({ articleContent: e.target.value })}
						placeholder="Paste or type the article content here..."
						className={`${clinicTextareaClass} min-h-[220px]`}
					/>
				</div>
			</div>
		</div>
	);
}
