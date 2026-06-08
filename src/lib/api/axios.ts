// Axios instance for API requests
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/** Parse JSON API error bodies into a user-visible string (handles non-standard shapes). */
function messageFromResponseData(data: unknown): string | undefined {
	if (data == null) return undefined;
	if (typeof data === 'string') {
		const t = data.trim();
		if (t.startsWith('{') && t.endsWith('}')) {
			try {
				const parsed = JSON.parse(t) as Record<string, unknown>;
				if (typeof parsed.message === 'string' && parsed.message.trim()) {
					return parsed.message.trim();
				}
				if (typeof parsed.error === 'string' && parsed.error.trim()) {
					return parsed.error.trim();
				}
			} catch {
				return undefined;
			}
		}
		return undefined;
	}
	if (typeof data === 'object' && !Array.isArray(data)) {
		const o = data as Record<string, unknown>;
		const baseMessage =
			(typeof o.message === 'string' && o.message.trim()) ||
			(typeof o.error === 'string' && o.error.trim()) ||
			(typeof o.detail === 'string' && o.detail.trim()) ||
			'';

		if (Array.isArray(o.errors) && o.errors.length > 0) {
			const detailMessages = o.errors
				.map((issue) => {
					if (typeof issue === 'string' && issue.trim()) return issue.trim();
					if (issue && typeof issue === 'object' && 'message' in issue) {
						const message = (issue as { message?: unknown }).message;
						if (typeof message === 'string' && message.trim()) {
							const path = (issue as { path?: unknown }).path;
							if (Array.isArray(path) && path.length > 0) {
								return `${path.join('.')}: ${message.trim()}`;
							}
							return message.trim();
						}
					}
					return null;
				})
				.filter((msg): msg is string => Boolean(msg));

			if (detailMessages.length > 0) {
				const prefix = baseMessage || 'Validation failed';
				return `${prefix}: ${detailMessages.join('; ')}`;
			}
		}

		if (baseMessage) return baseMessage;
	}
	return undefined;
}

function rejectWithApiError(error: AxiosError): Promise<never> {
	const status = error.response?.status;
	const fromBody = messageFromResponseData(error.response?.data);
	const fallback =
		status != null
			? `Something went wrong (HTTP ${status}). Please try again.`
			: 'Network error. Please check your connection and try again.';
	const errorMessage = fromBody || fallback;
	return Promise.reject(new Error(errorMessage));
}

// Client: absolute URL on current origin (one build, staging vs prod). SSR: relative.
const apiDefaultBaseURL =
	typeof window !== "undefined"
		? `${window.location.origin}/api/v1`
		: "/api/v1";

const apiClient: AxiosInstance = axios.create({
	baseURL: apiDefaultBaseURL,
	timeout: 30000, // 30 seconds
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true, // Important for cookie-based auth (Better Auth)
});

// Request interceptor
apiClient.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// Add any auth tokens or headers here if needed
		return config;
	},
	(error: AxiosError) => {
		return Promise.reject(error);
	}
);

// Response interceptor
apiClient.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error: AxiosError) => {
		// 401 → full redirect to login. If you see redirect loops on staging, capture this
		// request in DevTools (same host as the page? cookie sent?) and align
		// NEXT_PUBLIC_API_URL / BETTER_AUTH_URL per .env.example — not middleware.
		if (error.response?.status === 401) {
			if (typeof window !== 'undefined') {
				// Avoid redirect churn if already on login; primary fix is session cookies.
				if (window.location.pathname.startsWith('/auth/login')) {
					return rejectWithApiError(error);
				}
				const authStore = (await import('@/store/auth-store')).useAuthStore.getState();
				authStore.logout();
				window.location.href = '/auth/login';
			}
		}

		return rejectWithApiError(error);
	}
);

export default apiClient;

