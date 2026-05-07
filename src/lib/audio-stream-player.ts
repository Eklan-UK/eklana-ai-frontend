/**
 * Handles streaming PCM audio from Gemini
 * Queues up base64 chunks and plays them seamlessly using the Web Audio API
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private stopped = false;
  private onEndedCallback: (() => void) | null = null;
  /** Counts scheduled BufferSources that have not yet fired onended. */
  private pendingBuffers: number = 0;

  constructor(onEnded?: () => void) {
    this.onEndedCallback = onEnded || null;
  }

  private initContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Gemini native audio is strictly 24000Hz PCM
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.audioContext.currentTime + 0.1; // tiny buffer
      this.isPlaying = true;
    }
    // iOS starts AudioContexts in "suspended" state — resume so playback works
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  /** Expose the underlying context so callers can unlock it on user gesture. */
  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Decodes Base64 PCM encoded sound to Float32Array (Gemini 16-bit PCM format)
   */
  private decodePcm(base64: string): Float32Array {
    const rawData = window.atob(base64);
    // 16-bit PCM = 2 bytes per sample
    const outputArray = new Float32Array(rawData.length / 2);
    for (let i = 0; i < rawData.length; i += 2) {
      let sample = (rawData.charCodeAt(i) & 0xff) | ((rawData.charCodeAt(i + 1) & 0xff) << 8);
      // sign extension
      if (sample & 0x8000) sample |= 0xffff0000;
      // Normalize to -1.0 to 1.0
      outputArray[i / 2] = sample / 32768.0;
    }
    return outputArray;
  }

  /**
   * Queues a base64 PCM chunk to play immediately following the previous chunk
   */
  public enqueueBase64Pcm(base64Data: string) {
    if (this.stopped) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      const float32Data = this.decodePcm(base64Data);
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Ensures chunks play perfectly back-to-back without popping
      const playTime = Math.max(this.audioContext.currentTime, this.nextPlayTime);
      source.start(playTime);
      this.nextPlayTime = playTime + audioBuffer.duration;

      // Handle sequence ending: decrement counter; fire callback when the last buffer finishes.
      this.pendingBuffers++;
      source.onended = () => {
        this.pendingBuffers--;
        if (this.pendingBuffers === 0) {
          this.isPlaying = false;
          this.onEndedCallback?.();
        }
      };
    } catch (err) {
      console.error("Error playing PCM audio chunk", err);
    }
  }

  public stop() {
    this.stopped = true;
    this.pendingBuffers = 0;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
    }
    this.audioContext = null;
    this.isPlaying = false;
    this.nextPlayTime = 0;
    if (this.onEndedCallback) this.onEndedCallback();
  }

  /**
   * Call once the SSE stream has fully finished sending chunks.
   * If no audio was ever queued (or all buffers have already played), fires
   * onEndedCallback immediately — prevents the "Speaking…" indicator from
   * getting permanently stuck when the server sends no audio chunks.
   */
  public signalStreamEnd() {
    if (!this.stopped && this.pendingBuffers === 0 && !this.isPlaying) {
      this.onEndedCallback?.();
    }
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}
