import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	enrichLearnerDrillRowWithTopicTitle,
	enrichLearnerDrillRowsWithTopicTitle,
} from './enrich-learner-drill-topic';

describe('enrichLearnerDrillRowWithTopicTitle', () => {
	it('adds topicTitle for a standard drill with learning_journey_topic', () => {
		const row = {
			assignmentId: 'a1',
			drill: {
				_id: 'd1',
				title: 'ICU Vocab',
				learning_journey_topic: 'handling_emergency_critical',
			},
		};

		const enriched = enrichLearnerDrillRowWithTopicTitle(row);

		assert.equal(
			(enriched.drill as { topicTitle?: string }).topicTitle,
			'Handling Emergency/Critical Situation',
		);
	});

	it('adds topicTitle for Free Talk via scenarioType', () => {
		const row = {
			assignmentId: 'ft1',
			drill: {
				_id: 'ft1',
				title: 'Emergency scenario',
				type: 'eklan_free_talk',
				scenarioType: 'icu_emergency',
			},
		};

		const enriched = enrichLearnerDrillRowWithTopicTitle(row);

		assert.equal(
			(enriched.drill as { topicTitle?: string }).topicTitle,
			'Handling Emergency/Critical Situation',
		);
	});

	it('returns row unchanged when drill is missing', () => {
		const row = { assignmentId: 'a1' };
		assert.equal(enrichLearnerDrillRowWithTopicTitle(row), row);
	});

	it('returns row unchanged when topic cannot be resolved', () => {
		const row = {
			drill: { _id: 'd1', title: 'Untagged drill' },
		};
		const enriched = enrichLearnerDrillRowWithTopicTitle(row);
		assert.equal((enriched.drill as { topicTitle?: string }).topicTitle, undefined);
	});
});

describe('enrichLearnerDrillRowsWithTopicTitle', () => {
	it('enriches every row in the array', () => {
		const rows = [
			{
				drill: { learning_journey_topic: 'conducting_cpr' },
			},
			{
				drill: { scenarioType: 'icu_emergency' },
			},
		];

		const enriched = enrichLearnerDrillRowsWithTopicTitle(rows);

		assert.equal(
			(enriched[0]!.drill as { topicTitle?: string }).topicTitle,
			'Conducting CPR',
		);
		assert.equal(
			(enriched[1]!.drill as { topicTitle?: string }).topicTitle,
			'Handling Emergency/Critical Situation',
		);
	});
});
