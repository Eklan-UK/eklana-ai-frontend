'use client';

import { Headphones } from 'lucide-react';
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
	contentTitle: string;
	content: string;
	onChange: (patch: { contentTitle?: string; content?: string }) => void;
};

export function ClinicListeningPanel({
	contentTitle,
	content,
	onChange,
}: Props) {
	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
						<Headphones className="h-4 w-4" />
					</div>
					<div>
						<p className={clinicSectionTitleClass}>
							Listening Content <span className="text-red-500">*</span>
						</p>
						<p className={`${clinicHelperClass} mt-0.5`}>
							Add content that students will listen to using text-to-speech
							(ElevenLabs). Markdown formatting is supported for better
							readability.
						</p>
					</div>
				</div>
			</div>
			<div className={clinicCardBodyClass}>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-listening-title">
						Content Title
					</label>
					<input
						id="clinic-listening-title"
						value={contentTitle}
						onChange={(e) => onChange({ contentTitle: e.target.value })}
						placeholder="e.g. Ward Handover"
						className={clinicInputClass}
					/>
				</div>
				<div>
					<label className={clinicLabelClass} htmlFor="clinic-listening-content">
						Content <span className="text-red-500">*</span>
					</label>
					<textarea
						id="clinic-listening-content"
						value={content}
						onChange={(e) => onChange({ content: e.target.value })}
						placeholder="Paste or type your listening content here. Markdown formatting is supported..."
						className={`${clinicTextareaClass} min-h-[220px]`}
					/>
					<p className={`${clinicHelperClass} mt-1.5`}>
						Markdown supported. Paste formatted text for auto-formatting.
					</p>
				</div>
			</div>
		</div>
	);
}
