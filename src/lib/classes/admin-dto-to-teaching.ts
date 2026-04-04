import type { AdminClassListItemDTO } from '@/domain/classes/class.api.types';
import type { TeachingClass } from '@/app/(admin)/admin/classes/types';

/** Maps API list row to UI `TeachingClass` (card + drawer). */
export function adminDtoToTeachingClass(d: AdminClassListItemDTO): TeachingClass {
  return {
    id: d.id,
    title: d.title,
    studentLabel: d.studentLabel,
    extraStudents: d.extraStudents,
    tutorName: d.tutorName,
    classType: d.classType,
    participants: d.participants.map((p) => ({ initials: p.initials })),
    scheduleDays: d.scheduleDays,
    timeRange: d.timeRange,
    completedSessions: d.completedSessions,
    totalSessions: d.totalSessions,
    nextSessionLabel: d.nextSessionLabel,
    nextSessionId: d.nextSessionId,
    status: d.status,
    bucket: d.bucket,
    meetingUrl: d.meetingUrl ?? d.drawer?.meetingUrl,
    drawer: d.drawer,
  };
}
