// Axios instance for API requests
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
	baseURL: '/api/v1',
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
		// Handle 401 Unauthorized - session expired
		if (error.response?.status === 401) {
			// Clear auth state and redirect to login
			if (typeof window !== 'undefined') {
				const authStore = (await import('@/store/auth-store')).useAuthStore.getState();
				authStore.logout();
				window.location.href = '/auth/login';
			}
		}

		// Extract error message
		const errorMessage =
			(error.response?.data as any)?.message ||
			error.message ||
			`HTTP error! status: ${error.response?.status}`;

		return Promise.reject(new Error(errorMessage));
	}
);

export default apiClient;

