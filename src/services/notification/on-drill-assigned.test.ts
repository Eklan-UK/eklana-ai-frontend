import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onDrillAssigned } from './triggers';

describe('onDrillAssigned', () => {
  it('uses sendUnifiedWithFcmFallback with type drill_assigned (no FCM early return)', async () => {
    const sendUnified = mock.fn(async () => ({
      delivered: true,
      pushDelivered: false,
      inAppCreated: true,
      unified: { notificationId: 'notif-1' },
      fcm: null,
    }));

    const result = await onDrillAssigned(
      '507f1f77bcf86cd799439011',
      { _id: '507f1f77bcf86cd799439012', title: 'Vowel practice', type: 'pronunciation' },
      { firstName: 'Ada', lastName: 'Tutor' },
      {
        connect: async () => undefined,
        sendUnified: sendUnified as never,
      }
    );

    assert.ok(result);
    assert.equal(sendUnified.mock.callCount(), 1);

    const params = sendUnified.mock.calls[0]?.arguments[0] as {
      type: string;
      userId: string;
      data?: { screen?: string; url?: string; resourceId?: string };
      actionUrl?: string;
    };

    assert.equal(params.type, 'drill_assigned');
    assert.equal(params.userId, '507f1f77bcf86cd799439011');
    assert.equal(params.data?.screen, 'DrillDetail');
    assert.equal(params.data?.resourceId, '507f1f77bcf86cd799439012');
    assert.equal(params.data?.url, '/account/drills/507f1f77bcf86cd799439012');
    assert.equal(params.actionUrl, '/account/drills/507f1f77bcf86cd799439012');
  });
});
