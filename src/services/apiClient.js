import axios from 'axios';

const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? "http://localhost:4000/api"
        : "https://list-prices.onrender.com/api";
};

export const API_URL = getApiUrl();

const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true // Crucial: ensures httpOnly cookies are sent
});

// Memory storage for access token (never touches localStorage)
let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

// Request interceptor: automatically attach Bearer token
apiClient.interceptors.request.use(config => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
}, error => Promise.reject(error));

// Response interceptor: automatically handle expired access tokens
apiClient.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        
        // If API returns 401 Unauthorized, and we haven't retried yet:
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // Attempt to rotate the token using the HttpOnly cookie
                const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
                const newAccessToken = refreshRes.data.accessToken;
                
                setAccessToken(newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                
                // Retry the original request transparently
                return apiClient(originalRequest);
            } catch (err) {
                // Refresh failed (e.g. cookie expired or invalid), trigger hard logout
                setAccessToken(null);
                window.dispatchEvent(new Event('auth-expired'));
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
