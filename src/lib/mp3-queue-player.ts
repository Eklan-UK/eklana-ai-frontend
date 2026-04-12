/**
 * Play sequential MP3 blobs (e.g. ElevenLabs) without gaps between chunks.
 */
export class Mp3QueuePlayer {
	private queue: Blob[] = [];
	private playing = false;
	private disposed = false;
	private currentAudio: HTMLAudioElement | null = null;
	private objectUrl: string | null = null;

	constructor(private readonly onQueueEmpty?: () => void) {}

	enqueue(blob: Blob) {
		if (this.disposed) return;
		this.queue.push(blob);
		if (!this.playing) void this.playNext();
	}

	private async playNext() {
		if (this.disposed) {
			this.queue = [];
			this.playing = false;
			return;
		}
		if (this.queue.length === 0) {
			this.playing = false;
			this.cleanupCurrentUrl();
			this.onQueueEmpty?.();
			return;
		}
		this.playing = true;
		const blob = this.queue.shift()!;
		this.cleanupCurrentUrl();
		this.objectUrl = URL.createObjectURL(blob);
		const audio = new Audio(this.objectUrl);
		this.currentAudio = audio;
		audio.onended = () => {
			this.currentAudio = null;
			void this.playNext();
		};
		audio.onerror = () => {
			this.currentAudio = null;
			void this.playNext();
		};
		try {
			await audio.play();
		} catch {
			void this.playNext();
		}
	}

	private cleanupCurrentUrl() {
		if (this.objectUrl) {
			URL.revokeObjectURL(this.objectUrl);
			this.objectUrl = null;
		}
	}

	stop() {
		this.disposed = true;
		this.queue = [];
		if (this.currentAudio) {
			const el = this.currentAudio;
			el.pause();
			try {
				el.removeAttribute('src');
				el.load();
			} catch {
				/* ignore */
			}
			this.currentAudio = null;
		}
		this.cleanupCurrentUrl();
		this.playing = false;
	}
}
