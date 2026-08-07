/**
 * React Query hooks for Precision Clinic (admin).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { precisionClinicAPI } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { toast } from 'sonner';
import type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	PrecisionClinicPublishStatus,
	PrecisionClinicStats,
} from '@/domain/precision-clinic/types';

export type {
	PrecisionClinicDrillType,
	PrecisionClinicDifficulty,
	PrecisionClinicPublishStatus,
	PrecisionClinicStats,
	PrecisionClinicDrill,
	CreatePrecisionClinicDrillData,
	UpdatePrecisionClinicDrillData,
	ClinicSoundGroup,
	ClinicKeyPhraseQuestion,
	ClinicMatchingPair,
	ClinicGrammarPattern,
	ClinicSentenceWritingWord,
} from '@/domain/precision-clinic/types';

export {
	PRECISION_CLINIC_DRILL_TYPES,
	PRECISION_CLINIC_DIFFICULTIES,
	PRECISION_CLINIC_DRILL_TYPE_LABELS,
} from '@/domain/precision-clinic/types';

export type PrecisionClinicListFilters = {
	limit?: number;
	offset?: number;
	q?: string;
	type?: PrecisionClinicDrillType | string;
	difficulty?: PrecisionClinicDifficulty | string;
	status?: PrecisionClinicPublishStatus | string;
	includeArchived?: boolean;
	isArchived?: boolean;
};

export type PrecisionClinicListResult = {
	drills: any[];
	total: number;
	limit?: number;
	offset?: number;
	stats: PrecisionClinicStats;
};

function extractListPayload(response: any): PrecisionClinicListResult {
	const data = response?.data ?? response ?? {};
	const drills = data.drills ?? [];
	const stats: PrecisionClinicStats = data.stats ?? {
		total: typeof data.total === 'number' ? data.total : 0,
		practiceItems: 0,
		published: 0,
		assigned: 0,
	};
	return {
		drills: Array.isArray(drills) ? drills : [],
		total: typeof data.total === 'number' ? data.total : drills.length,
		limit: data.limit,
		offset: data.offset,
		stats,
	};
}

function extractDrill(response: any): any {
	return response?.data?.drill ?? response?.drill ?? response?.data ?? response;
}

export function usePrecisionClinicList(
	filters?: PrecisionClinicListFilters,
	options?: { enabled?: boolean }
) {
	return useQuery({
		queryKey: queryKeys.precisionClinic.list(filters),
		queryFn: async () => {
			const response = await precisionClinicAPI.getAll({
				limit: filters?.limit ?? 50,
				offset: filters?.offset ?? 0,
				q: filters?.q,
				type: filters?.type,
				difficulty: filters?.difficulty,
				status:
					filters?.status === 'published' || filters?.status === 'draft'
						? filters.status
						: undefined,
				includeArchived: filters?.includeArchived,
				isArchived: filters?.isArchived,
			});
			return extractListPayload(response);
		},
		staleTime: 1000 * 60 * 2,
		enabled: options?.enabled !== false,
	});
}

export function usePrecisionClinicDetail(
	id: string | undefined | null,
	options?: { enabled?: boolean }
) {
	return useQuery({
		queryKey: queryKeys.precisionClinic.detail(id ?? ''),
		queryFn: async () => {
			const response = await precisionClinicAPI.getById(String(id));
			return extractDrill(response);
		},
		enabled: Boolean(id) && options?.enabled !== false,
		staleTime: 1000 * 60 * 2,
	});
}

export function useCreatePrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: Record<string, unknown>) =>
			precisionClinicAPI.create(data).then(extractDrill),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			toast.success('Clinic drill created');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to create clinic drill');
		},
	});
}

export function useUpdatePrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data: Record<string, unknown>;
		}) => precisionClinicAPI.update(id, data).then(extractDrill),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.detail(variables.id),
			});
			toast.success('Clinic drill updated');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to update clinic drill');
		},
	});
}

export function useDeletePrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => precisionClinicAPI.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			toast.success('Clinic drill deleted');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to delete clinic drill');
		},
	});
}

export function useAssignPrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			userIds,
		}: {
			id: string;
			userIds: string[];
		}) => precisionClinicAPI.assign(id, { userIds }).then(extractDrill),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.detail(variables.id),
			});
			toast.success('Learners assigned');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to assign learners');
		},
	});
}

export function useDuplicatePrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			precisionClinicAPI.duplicate(id).then(extractDrill),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			toast.success('Clinic drill duplicated');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to duplicate clinic drill');
		},
	});
}

export function useArchivePrecisionClinic() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			precisionClinicAPI.archive(id).then(extractDrill),
		onSuccess: (_data, id) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.all,
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.precisionClinic.detail(id),
			});
			toast.success('Clinic drill archived');
		},
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to archive clinic drill');
		},
	});
}

export function useAiGeneratePrecisionClinic() {
	return useMutation({
		mutationFn: (data: {
			students?: string[];
			studentIds?: string[];
			studentId?: string;
			title?: string;
			drillTypes: string[];
			difficulty?: 'beginner' | 'intermediate' | 'advanced';
			context?: string;
			prompt: string;
		}) =>
			precisionClinicAPI.aiGenerate(data).then((res) => {
				return res?.data ?? res;
			}),
		onError: (error: any) => {
			toast.error(error?.message || 'Failed to generate clinic content');
		},
	});
}
