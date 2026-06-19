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
});
