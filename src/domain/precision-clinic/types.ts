/** Dashboard card counts from Drill / DrillAssignment (source=precision_clinic). */
export interface PrecisionClinicStats {
	total: number;
	practiceItems: number;
	published: number;
	assigned: number;
}

export interface PrecisionClinicLearnerWeekListItem {
	/** String(builderWeekNumber) — kept as `learnerWeekId` so student components don't need changes. */
	learnerWeekId: string;
	personalWeekNumber: number;
	title: string;
	status: 'ready';
	totalItems: number;
	/** Count of assignments with `status === 'completed'`. */
	completedItems: number;
	assignedAt: string;
}

export interface PrecisionClinicLearnerWeekHistoryResponse {
	weeks: PrecisionClinicLearnerWeekListItem[];
}

export interface PrecisionClinicLearnerWeekDrillListItem {
	index: number;
	/** Assignment id (stable list key). */
	itemId: string;
	/** Same as `drillId` — kept for older clients. */
	sourceDrillId: string;
	/** Drill document id — used to open the practice player. */
	drillId: string;
	/** DrillAssignment id — passed as `?assignmentId=` to the player. */
	assignmentId: string;
	title: string;
	/** General Drill `type` (Precision Clinic now reuses Drill Builder content). */
	type: string;
	difficulty: string;
	status: 'pending' | 'in-progress' | 'completed' | 'overdue';
	/** True when assignment `status === 'completed'`. */
	completed: boolean;
	sortOrder: number;
}

export interface PrecisionClinicLearnerWeekDetailResponse {
	learnerWeekId: string;
	personalWeekNumber: number;
	title: string;
	status: 'ready';
	totalItems: number;
	completedItemIndexes: number[];
	assignedAt: string;
	drills: PrecisionClinicLearnerWeekDrillListItem[];
}
