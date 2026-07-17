import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseProviderError } from './tts-provider.service';

describe('parseProviderError', () => {
  it('maps ElevenLabs 401 to HTTP 502 with TTSProviderAuthError', () => {
    const info = parseProviderError(401, 'Unauthorized', '{"detail":{"message":"Invalid API key"}}');
    assert.equal(info.code, 'TTSProviderAuthError');
    assert.equal(info.status, 502);
    assert.equal(info.message, 'ElevenLabs API key is invalid or expired');
  });

  it('maps ElevenLabs 402 to HTTP 502 with TTSProviderPlanError', () => {
    const info = parseProviderError(402, 'Payment Required', '');
    assert.equal(info.code, 'TTSProviderPlanError');
    assert.equal(info.status, 502);
    assert.match(info.message, /account plan/i);
  });

  it('keeps ElevenLabs 429 as 429', () => {
    const info = parseProviderError(429, 'Too Many Requests', '');
    assert.equal(info.code, 'TTSProviderRateLimit');
    assert.equal(info.status, 429);
  });

  it('forwards other provider statuses and parses JSON message', () => {
    const info = parseProviderError(
      500,
      'Internal Server Error',
      '{"message":"upstream exploded"}'
    );
    assert.equal(info.code, 'TTSProviderError');
    assert.equal(info.status, 500);
    assert.equal(info.message, 'upstream exploded');
  });
});
