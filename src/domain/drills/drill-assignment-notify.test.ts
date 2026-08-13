import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { notifyLearnerOfAssignment } from './drill.service';

const LEARNER_ID = '507f1f77bcf86cd799439011';
const DRILL_ID = '507f1f77bcf86cd799439012';
const ASSIGNMENT_ID = '507f1f77bcf86cd799439013';

describe('notifyLearnerOfAssignment', () => {
  let sendEmail: ReturnType<typeof mock.fn>;
  let sendPush: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    sendEmail = mock.fn(async () => undefined);
    sendPush = mock.fn(async () => ({ unified: {}, fcm: null, pushDelivered: true }));
  });

  it('skips both channels when learningReminders is false', async () => {
    const result = await notifyLearnerOfAssignment(
      {
        learnerId: LEARNER_ID,
        drill: { _id: DRILL_ID, title: 'Vowel practice', type: 'pronunciation' },
        assigner: { firstName: 'Ada', lastName: 'Tutor' },
        assignmentId: ASSIGNMENT_ID,
      },
      {
        findProfile: async () => ({
          notificationPreferences: { learningReminders: false },
        }),
        findLearner: async () => ({
          email: 'student@example.com',
          firstName: 'Sam',
          lastName: 'Learner',
        }),
        sendEmail: sendEmail as never,
        sendPush: sendPush as never,
      }
    );

    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'prefs_disabled');
    assert.equal(sendEmail.mock.callCount(), 0);
    assert.equal(sendPush.mock.callCount(), 0);
  });

  it('invokes email and onDrillAssigned when prefs allow', async () => {
    const result = await notifyLearnerOfAssignment(
      {
        learnerId: LEARNER_ID,
        drill: { _id: DRILL_ID, title: 'Vowel practice', type: 'pronunciation' },
        assigner: { firstName: 'Ada', lastName: 'Tutor' },
        dueDate: new Date('2026-07-20T00:00:00.000Z'),
        assignmentId: ASSIGNMENT_ID,
      },
      {
        findProfile: async () => ({
          notificationPreferences: { learningReminders: true },
        }),
        findLearner: async () => ({
          email: 'student@example.com',
          firstName: 'Sam',
          lastName: 'Learner',
        }),
        sendEmail: sendEmail as never,
        sendPush: sendPush as never,
      }
    );

    assert.equal(result.status, 'sent');
    assert.deepEqual(result.channels, { email: true, push: true });
    assert.equal(sendEmail.mock.callCount(), 1);
    assert.equal(sendPush.mock.callCount(), 1);

    const emailArgs = sendEmail.mock.calls[0]?.arguments[0] as {
      studentEmail: string;
      drillTitle: string;
      drillType: string;
      assignerName: string;
      drillId: string;
      assignmentId: string;
    };
    assert.equal(emailArgs.studentEmail, 'student@example.com');
    assert.equal(emailArgs.drillTitle, 'Pronunciation · Vowel practice');
    assert.equal(emailArgs.drillType, 'Pronunciation');
    assert.equal(emailArgs.assignerName, 'Ada Tutor');
    assert.equal(emailArgs.drillId, DRILL_ID);
    assert.equal(emailArgs.assignmentId, ASSIGNMENT_ID);

    const pushArgs = sendPush.mock.calls[0]?.arguments;
    assert.equal(pushArgs?.[0], LEARNER_ID);
    assert.deepEqual(pushArgs?.[1], {
      _id: DRILL_ID,
      title: 'Pronunciation · Vowel practice',
      type: 'pronunciation',
    });
  });

  it('still sends push when learner has no email', async () => {
    const result = await notifyLearnerOfAssignment(
      {
        learnerId: LEARNER_ID,
        drill: { _id: DRILL_ID, title: 'Roleplay', type: 'roleplay' },
        assigner: { name: 'Coach' },
      },
      {
        findProfile: async () => ({}),
        findLearner: async () => ({ firstName: 'Sam' }),
        sendEmail: sendEmail as never,
        sendPush: sendPush as never,
      }
    );

    assert.equal(result.status, 'sent');
    assert.deepEqual(result.channels, { email: false, push: true });
    assert.equal(sendEmail.mock.callCount(), 0);
    assert.equal(sendPush.mock.callCount(), 1);
  });

  it('composes email/push label when title is empty', async () => {
    const result = await notifyLearnerOfAssignment(
      {
        learnerId: LEARNER_ID,
        drill: {
          _id: DRILL_ID,
          title: '',
          type: 'vocabulary',
          learning_journey_part: 1,
          learning_journey_topic: 'patient_follow_up',
        },
        assigner: { firstName: 'Ada', lastName: 'Tutor' },
        assignmentId: ASSIGNMENT_ID,
      },
      {
        findProfile: async () => ({
          notificationPreferences: { learningReminders: true },
        }),
        findLearner: async () => ({
          email: 'student@example.com',
          firstName: 'Sam',
          lastName: 'Learner',
        }),
        sendEmail: sendEmail as never,
        sendPush: sendPush as never,
      }
    );

    assert.equal(result.status, 'sent');
    const expectedLabel = 'Vocabulary/Phrase · Mission 1 · Follow-up with Patients';

    const emailArgs = sendEmail.mock.calls[0]?.arguments[0] as {
      drillTitle: string;
      drillType: string;
      missionLabel?: string;
      topicLabel?: string;
    };
    assert.equal(emailArgs.drillTitle, expectedLabel);
    assert.equal(emailArgs.drillType, 'Vocabulary/Phrase');
    assert.equal(emailArgs.missionLabel, 'Mission 1');
    assert.equal(emailArgs.topicLabel, 'Follow-up with Patients');

    const pushDrill = sendPush.mock.calls[0]?.arguments[1] as {
      title: string;
      type: string;
    };
    assert.equal(pushDrill.title, expectedLabel);
    assert.equal(pushDrill.type, 'vocabulary');
  });

  it('ignores Untitled title when composing notification label', async () => {
    await notifyLearnerOfAssignment(
      {
        learnerId: LEARNER_ID,
        drill: {
          _id: DRILL_ID,
          title: 'Untitled Drill',
          type: 'pronunciation',
          learning_journey_part: 2,
          learning_journey_topic: 'giving_handover',
        },
        assigner: { name: 'Coach' },
      },
      {
        findProfile: async () => ({}),
        findLearner: async () => ({
          email: 'student@example.com',
          firstName: 'Sam',
        }),
        sendEmail: sendEmail as never,
        sendPush: sendPush as never,
      }
    );

    const expectedLabel = 'Pronunciation · Mission 2 · Giving an Handover';
    const emailArgs = sendEmail.mock.calls[0]?.arguments[0] as {
      drillTitle: string;
    };
    assert.equal(emailArgs.drillTitle, expectedLabel);
    assert.equal(
      (sendPush.mock.calls[0]?.arguments[1] as { title: string }).title,
      expectedLabel
    );
  });
});
