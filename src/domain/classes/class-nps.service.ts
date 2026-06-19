import ClassSession from '@/models/class-session';
import ClassSeries from '@/models/class-series';
import SessionAttendance from '@/models/session-attendance';
import SessionNpsDispatch from '@/models/session-nps-dispatch';
import NpsForm, { NPS_FORM_SINGLETON_KEY } from '@/models/nps-form';
import User from '@/models/user';
import { logger } from '@/lib/api/logger';
import { sendNpsFormEmail } from '@/lib/api/email.service';

/** Look back this far for sessions that just ended (cron runs every minute). */
const TOLERANCE_MS = 2 * 60 * 1000;

export class ClassNpsService {
  /**
   * Called every minute by the cron route.
   * Finds sessions that ended within the last 2 minutes for NPS-enabled series,
   * emails present/late attendees once per session (deduped via SessionNpsDispatch).
   */
  async runDueNpsEmails(now: Date = new Date()): Promise<{
    examined: number;
    sent: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let sent = 0;
    let skipped = 0;
    let examined = 0;

    const nowMs = now.getTime();
    const windowStart = new Date(nowMs - TOLERANCE_MS);

    const sessions = await ClassSession.find({
      status: { $ne: 'cancelled' },
      endUtc: { $gte: windowStart, $lte: now },
    })
      .lean()
      .exec();

    for (const session of sessions) {
      examined += 1;

      const series = await ClassSeries.findById(session.classSeriesId).lean();
      if (!series?.isActive || !series.npsEnabled) continue;

      const alreadySent = await SessionNpsDispatch.findOne({
        sessionId: session._id,
      }).lean();
      if (alreadySent) {
        skipped += 1;
        continue;
      }

      const npsForm = await NpsForm.findOne({
        key: NPS_FORM_SINGLETON_KEY,
        isActive: true,
      }).lean();
      if (!npsForm) {
        skipped += 1;
        continue;
      }

      const attendances = await SessionAttendance.find({
        sessionId: session._id,
        status: { $in: ['present', 'late'] },
      })
        .lean()
        .exec();

      const seriesTitle = series.title?.trim() || 'Your class';

      for (const att of attendances) {
        const learner = await User.findById(att.learnerId)
          .select('email firstName lastName name')
          .lean();
        if (!learner?.email) continue;

        const name =
          `${(learner as { firstName?: string }).firstName ?? ''} ${(learner as { lastName?: string }).lastName ?? ''}`.trim() ||
          (learner as { name?: string }).name ||
          'Student';

        try {
          await sendNpsFormEmail({
            studentEmail: learner.email as string,
            studentName: name,
            classTitle: seriesTitle,
            formName: npsForm.name,
            formUrl: npsForm.url,
          });
          sent += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${session._id}/${att.learnerId}/email: ${msg}`);
          logger.warn('NPS form email failed', {
            sessionId: session._id,
            learnerId: att.learnerId,
            msg,
          });
        }
      }

      try {
        await SessionNpsDispatch.create({
          sessionId: session._id,
          sentAt: new Date(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('duplicate key') && !msg.includes('E11000')) {
          logger.warn('SessionNpsDispatch.create failed', { msg });
        }
      }
    }

    return { examined, sent, skipped, errors };
  }
}
