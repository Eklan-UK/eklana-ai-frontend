import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDrillTopicTitle } from './drill-display-label';

describe('getDrillTopicTitle', () => {
	it('resolves topic title from learning_journey_topic slug', () => {
		assert.equal(
			getDrillTopicTitle({ learning_journey_topic: 'handling_emergency_critical' }),
			'Handling Emergency/Critical Situation',
		);
	});

	it('maps Free Talk scenarioType to catalog topic title', () => {
		assert.equal(
			getDrillTopicTitle({ scenarioType: 'icu_emergency' }),
			'Handling Emergency/Critical Situation',
		);
	});

	it('prefers learning_journey_topic over scenarioType', () => {
		assert.equal(
			getDrillTopicTitle({
				learning_journey_topic: 'conducting_cpr',
				scenarioType: 'icu_emergency',
			}),
			'Conducting CPR',
		);
	});

	it('returns null when metadata is absent', () => {
		assert.equal(getDrillTopicTitle({}), null);
		assert.equal(getDrillTopicTitle(null), null);
	});

	it('returns null for unknown topic slug', () => {
		assert.equal(
			getDrillTopicTitle({ learning_journey_topic: 'unknown_topic_slug' }),
			null,
		);
	});

	it('returns null for unknown scenarioType', () => {
		assert.equal(getDrillTopicTitle({ scenarioType: 'unknown_scenario' }), null);
	});
});
