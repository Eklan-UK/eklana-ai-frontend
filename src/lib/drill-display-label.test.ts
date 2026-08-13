import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	formatDrillNotificationLabel,
	getDrillTopicTitle,
	resolveDrillListTitle,
	resolveRealDrillTitle,
} from './drill-display-label';

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

describe('resolveRealDrillTitle', () => {
	it('returns trimmed real titles', () => {
		assert.equal(resolveRealDrillTitle(' Soft palate practice '), 'Soft palate practice');
	});

	it('treats blank and Untitled* as absent', () => {
		assert.equal(resolveRealDrillTitle(''), null);
		assert.equal(resolveRealDrillTitle('   '), null);
		assert.equal(resolveRealDrillTitle(null), null);
		assert.equal(resolveRealDrillTitle('Untitled'), null);
		assert.equal(resolveRealDrillTitle('untitled drill'), null);
		assert.equal(resolveRealDrillTitle('Untitled Drill'), null);
	});
});

describe('resolveDrillListTitle', () => {
	it('returns a real title when present', () => {
		assert.equal(
			resolveDrillListTitle({
				title: ' Soft palate practice ',
				type: 'vocabulary',
				learning_journey_topic: 'patient_follow_up',
			}),
			'Soft palate practice',
		);
	});

	it('falls back to topic for blank titles', () => {
		assert.equal(
			resolveDrillListTitle({
				title: '',
				type: 'vocabulary',
				learning_journey_topic: 'patient_follow_up',
			}),
			'Follow-up with Patients',
		);
	});

	it('falls back to topic for Untitled Drill', () => {
		assert.equal(
			resolveDrillListTitle({
				title: 'Untitled Drill',
				type: 'vocabulary',
				learning_journey_topic: 'handling_emergency_critical',
			}),
			'Handling Emergency/Critical Situation',
		);
	});

	it('prefers topicTitle over catalog slug lookup', () => {
		assert.equal(
			resolveDrillListTitle({
				title: 'Untitled',
				type: 'grammar',
				topicTitle: ' Custom Topic Label ',
				learning_journey_topic: 'patient_follow_up',
			}),
			'Custom Topic Label',
		);
	});

	it('falls back to type label when topic is missing', () => {
		assert.equal(
			resolveDrillListTitle({
				title: 'Untitled Drill',
				type: 'vocabulary',
			}),
			'Vocabulary/Phrase',
		);
		assert.equal(resolveDrillListTitle({ title: '' }), 'Practice');
		assert.equal(resolveDrillListTitle(null), 'Practice');
	});
});

describe('formatDrillNotificationLabel', () => {
	it('joins type, mission, and topic when title is empty', () => {
		assert.equal(
			formatDrillNotificationLabel({
				title: '',
				type: 'vocabulary',
				learning_journey_part: 1,
				learning_journey_topic: 'patient_follow_up',
			}),
			'Vocabulary/Phrase · Mission 1 · Follow-up with Patients',
		);
	});

	it('appends a real title when present', () => {
		assert.equal(
			formatDrillNotificationLabel({
				title: 'Soft palate practice',
				type: 'vocabulary',
				learning_journey_part: 1,
				learning_journey_topic: 'patient_follow_up',
			}),
			'Vocabulary/Phrase · Mission 1 · Follow-up with Patients · Soft palate practice',
		);
	});

	it('ignores Untitled titles', () => {
		assert.equal(
			formatDrillNotificationLabel({
				title: 'Untitled Drill',
				type: 'pronunciation',
				learning_journey_part: 2,
				learning_journey_topic: 'giving_handover',
			}),
			'Pronunciation · Mission 2 · Giving a Handover',
		);
	});

	it('falls back to type only when mission/topic/title are missing', () => {
		assert.equal(
			formatDrillNotificationLabel({ type: 'pronunciation' }),
			'Pronunciation',
		);
		assert.equal(formatDrillNotificationLabel({}), 'Practice');
		assert.equal(formatDrillNotificationLabel(null), 'Practice');
	});

	it('omits mission or topic when absent or unknown', () => {
		assert.equal(
			formatDrillNotificationLabel({
				type: 'grammar',
				learning_journey_part: 3,
			}),
			'Grammar · Mission 3',
		);
		assert.equal(
			formatDrillNotificationLabel({
				type: 'grammar',
				learning_journey_topic: 'unknown_topic_slug',
			}),
			'Grammar',
		);
	});
});
