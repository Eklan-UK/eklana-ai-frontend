'use client';

import { Mic, ChevronDown } from 'lucide-react';
import {
	ACCENT_VOICE_GROUPS,
	ACCENT_VOICE_OPTIONS,
} from '@/services/tts-accent-voices';
import {
	clinicCardClass,
	clinicCardHeaderClass,
	clinicCardBodyClass,
	clinicLabelClass,
	clinicSelectClass,
	clinicSectionTitleClass,
	clinicHelperClass,
} from './clinic-create-styles';

type Props = {
	preGenerateAudio: boolean;
	ttsVoiceKey: string;
	onChange: (patch: { preGenerateAudio?: boolean; ttsVoiceKey?: string }) => void;
};

export function ClinicAudioSettingsPanel({
	preGenerateAudio,
	ttsVoiceKey,
	onChange,
}: Props) {
	return (
		<div className={clinicCardClass}>
			<div className={clinicCardHeaderClass}>
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
						<Mic className="h-4 w-4" />
					</div>
					<p className={clinicSectionTitleClass}>Audio Settings</p>
				</div>
			</div>
			<div className={clinicCardBodyClass}>
				<div className="flex items-start justify-between gap-3 rounded-2xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:border-green-900/40 dark:from-green-950/30 dark:to-emerald-950/20">
					<div className="min-w-0 flex-1">
						<p className="text-sm font-bold text-gray-900 dark:text-foreground">
							Pre-generate Audio (Recommended)
						</p>
						<p className={`${clinicHelperClass} mt-1`}>
							Generates TTS audio using ElevenLabs when saving. Audio is stored
							for instant playback and lower latency during practice.
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={preGenerateAudio}
						onClick={() => onChange({ preGenerateAudio: !preGenerateAudio })}
						className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
							preGenerateAudio ? 'bg-[#418b43]' : 'bg-gray-300 dark:bg-muted'
						}`}
					>
						<span
							className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
								preGenerateAudio ? 'translate-x-5' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>

				<div className="relative">
					<label className={clinicLabelClass} htmlFor="clinic-voice">
						Accent / Voice
					</label>
					<select
						id="clinic-voice"
						value={ttsVoiceKey}
						onChange={(e) => onChange({ ttsVoiceKey: e.target.value })}
						className={clinicSelectClass}
					>
						<option value="">Default voice</option>
						{ACCENT_VOICE_GROUPS.map((group) => (
							<optgroup key={group.id} label={group.label}>
								{ACCENT_VOICE_OPTIONS.filter((opt) => opt.group === group.id).map(
									(opt) => (
										<option key={opt.key} value={opt.key}>
											{opt.label}
										</option>
									)
								)}
							</optgroup>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-gray-400" />
				</div>
			</div>
		</div>
	);
}
