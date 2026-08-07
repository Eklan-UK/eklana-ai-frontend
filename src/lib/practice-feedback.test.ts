import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const vibrateMock = mock.fn(() => true);

class MockOscillator {
  type = "sine";
  frequency = { setValueAtTime: mock.fn() };
  connect = mock.fn();
  start = mock.fn();
  stop = mock.fn();
}

class MockGainNode {
  gain = {
    setValueAtTime: mock.fn(),
    exponentialRampToValueAtTime: mock.fn(),
  };
  connect = mock.fn();
}

class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createOscillator = mock.fn(() => new MockOscillator());
  createGain = mock.fn(() => new MockGainNode());
  resume = mock.fn(async () => undefined);
}

describe("practice-feedback", () => {
  let originalNavigator: Navigator | undefined;
  let originalWindow: typeof globalThis.window | undefined;
  let originalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    vibrateMock.mock.resetCalls();
    originalNavigator = globalThis.navigator;
    originalWindow = globalThis.window;
    originalAudioContext = globalThis.AudioContext;

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { vibrate: vibrateMock },
    });

    const MockCtx = MockAudioContext as unknown as typeof AudioContext;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { AudioContext: MockCtx },
    });
    globalThis.AudioContext = MockCtx;
  });

  afterEach(() => {
    if (originalNavigator !== undefined) {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
    if (originalWindow !== undefined) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
    if (originalAudioContext !== undefined) {
      globalThis.AudioContext = originalAudioContext;
    } else {
      // @ts-expect-error cleanup test global
      delete globalThis.AudioContext;
    }
  });

  it("vibrates with the success pattern", async () => {
    const { triggerHaptic } = await import("./practice-feedback");
    triggerHaptic("success");
    assert.equal(vibrateMock.mock.callCount(), 1);
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[40, 30, 40]]);
  });

  it("vibrates with the failure pattern", async () => {
    const { triggerHaptic } = await import("./practice-feedback");
    triggerHaptic("failure");
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[120, 60, 120]]);
  });

  it("vibrates with the neutral pattern", async () => {
    const { triggerHaptic } = await import("./practice-feedback");
    triggerHaptic("neutral");
    assert.equal(vibrateMock.mock.callCount(), 1);
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[25]]);
  });

  it("does not throw when vibrate is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    const { triggerHaptic } = await import("./practice-feedback");
    assert.doesNotThrow(() => triggerHaptic("success"));
  });

  it("does not throw when AudioContext is unavailable", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    // @ts-expect-error cleanup test global
    delete globalThis.AudioContext;
    const { playTone } = await import("./practice-feedback");
    await assert.doesNotReject(async () => playTone("failure"));
  });

  it("playPracticeFeedback triggers haptic and tone", async () => {
    const { playPracticeFeedback } = await import("./practice-feedback");
    assert.doesNotThrow(() => playPracticeFeedback("success"));
    assert.equal(vibrateMock.mock.callCount(), 1);
  });

  it("playPracticeFeedback supports neutral kind", async () => {
    const { playPracticeFeedback } = await import("./practice-feedback");
    assert.doesNotThrow(() => playPracticeFeedback("neutral"));
    assert.equal(vibrateMock.mock.callCount(), 1);
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[25]]);
  });

  it("playDrillEndCelebration triggers success haptic", async () => {
    const playMock = mock.fn(async () => undefined);
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playDrillEndCelebration } = await import("./practice-feedback");
    assert.doesNotThrow(() => playDrillEndCelebration());
    assert.equal(vibrateMock.mock.callCount(), 1);
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[40, 30, 40]]);
    assert.equal(playMock.mock.callCount(), 1);
  });

  it("playDrillEndCelebration defaults to the pass confetti variant", async () => {
    const playMock = mock.fn(async () => undefined);
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playDrillEndCelebration } = await import("./practice-feedback");
    const { getDrillConfettiOptions } = await import("./drill-celebration");

    assert.doesNotThrow(() => playDrillEndCelebration());
    assert.deepEqual(getDrillConfettiOptions("pass").colors, [
      "#22c55e",
      "#16a34a",
      "#4ade80",
      "#86efac",
    ]);
  });

  it("playDrillEndCelebration forwards the perfect confetti variant", async () => {
    const playMock = mock.fn(async () => undefined);
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playDrillEndCelebration } = await import("./practice-feedback");
    const { getDrillConfettiOptions } = await import("./drill-celebration");

    assert.doesNotThrow(() =>
      playDrillEndCelebration(undefined, { confettiVariant: "perfect" }),
    );
    const perfectOptions = getDrillConfettiOptions("perfect");
    assert.deepEqual(perfectOptions.colors, ["#fbbf24", "#f59e0b", "#d97706", "#92400e"]);
    assert.equal(perfectOptions.particleCount, 200);
    assert.equal(perfectOptions.spread, 120);
  });

  it("playDrillEndFailure triggers failure haptic", async () => {
    const { playDrillEndFailure } = await import("./practice-feedback");
    assert.doesNotThrow(() => playDrillEndFailure());
    assert.equal(vibrateMock.mock.callCount(), 1);
    assert.deepEqual(vibrateMock.mock.calls[0]?.arguments, [[120, 60, 120]]);
  });

  it("playDrillEndCelebration plays the perfect sound URL when confettiVariant is perfect and no soundUrl is given", async () => {
    const playMock = mock.fn(async () => undefined);
    const constructedUrls: string[] = [];
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
      constructor(url: string) {
        constructedUrls.push(url);
      }
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playDrillEndCelebration } = await import("./practice-feedback");
    const { DEFAULT_PERFECT_CELEBRATION_SOUND_URL } = await import(
      "./drill/celebration-sound-url"
    );

    assert.doesNotThrow(() =>
      playDrillEndCelebration(undefined, { confettiVariant: "perfect" }),
    );
    assert.equal(constructedUrls.at(-1), DEFAULT_PERFECT_CELEBRATION_SOUND_URL);
  });

  it("playDrillEndCelebration prefers an explicit soundUrl even when confettiVariant is perfect", async () => {
    const playMock = mock.fn(async () => undefined);
    const constructedUrls: string[] = [];
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
      constructor(url: string) {
        constructedUrls.push(url);
      }
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playDrillEndCelebration } = await import("./practice-feedback");

    assert.doesNotThrow(() =>
      playDrillEndCelebration("https://example.com/custom.mp3", {
        confettiVariant: "perfect",
      }),
    );
    assert.equal(constructedUrls.at(-1), "https://example.com/custom.mp3");
  });

  it("playPerfectItemCelebration triggers success haptic, the perfect sound, and gold confetti", async () => {
    const playMock = mock.fn(async () => undefined);
    const constructedUrls: string[] = [];
    class MockAudio {
      src = "";
      play = playMock;
      pause = mock.fn();
      constructor(url: string) {
        constructedUrls.push(url);
      }
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MockAudio,
    });

    const { playPerfectItemCelebration } = await import("./practice-feedback");
    const { getDrillConfettiOptions } = await import("./drill-celebration");
    const { DEFAULT_PERFECT_CELEBRATION_SOUND_URL } = await import(
      "./drill/celebration-sound-url"
    );

    assert.doesNotThrow(() => playPerfectItemCelebration());
    assert.deepEqual(vibrateMock.mock.calls.at(-1)?.arguments, [[40, 30, 40]]);
    assert.equal(constructedUrls.at(-1), DEFAULT_PERFECT_CELEBRATION_SOUND_URL);
    assert.deepEqual(getDrillConfettiOptions("perfect").colors, [
      "#fbbf24",
      "#f59e0b",
      "#d97706",
      "#92400e",
    ]);
  });
});
