import axios from 'axios';
import { API_BASE_URL } from '../config';
import { decodeNamesInTree } from '../utils/textUtils';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Request Interceptor - Add Auth Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor for Global Error Handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized (Token Expired)
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                    // Attempt refresh
                    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refresh_token: refreshToken
                    });

                    if (res.data.access_token) {
                        // Success - Update tokens
                        localStorage.setItem('token', res.data.access_token);
                        // If refresh token rotated, update it too (though backend currently returns same)
                        if (res.data.refresh_token) {
                            localStorage.setItem('refreshToken', res.data.refresh_token);
                        }

                        // Update headers for retry
                        api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
                        originalRequest.headers['Authorization'] = `Bearer ${res.data.access_token}`;

                        // Retry original request
                        return api(originalRequest);
                    }
                }
            } catch (refreshError) {
                console.error("Refresh token failed", refreshError);
                // Fallthrough to redirect
            }

            // Only redirect if not already on auth pages
            if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
                console.warn("Session expired. Redirecting to login.");
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const getSettings = async () => {
    const response = await api.get('/settings/user');
    return response.data;
};

export const updateSettings = async (settings) => {
    const response = await api.put('/settings/user', settings);
    return response.data;
};

export const getBuckets = async () => {
    const response = await api.get('/settings/buckets');
    // Decode HTML entities in bucket names
    return decodeNamesInTree(response.data);
};

export const getBucketsTree = async () => {
    const response = await api.get('/settings/buckets/tree');
    // Decode HTML entities in category names (fixes &amp; display issue)
    return decodeNamesInTree(response.data);
};

export const getTags = async () => {
    const response = await api.get('/settings/tags');
    return response.data;
};

// Analytics
export const getCalendarData = async (start, end) => (await api.get('/analytics/calendar', { params: { start_date: start, end_date: end } })).data;
export const getSubscriptions = async () => (await api.get('/analytics/subscriptions')).data;
export const getSuggestedSubscriptions = async () => (await api.get('/analytics/subscriptions/suggested')).data;
export const createSubscription = async (data) => (await api.post('/analytics/subscriptions', data)).data;
export const updateSubscription = async (id, data) => (await api.put(`/analytics/subscriptions/${id}`, data)).data;
export const deleteSubscription = async (id) => (await api.delete(`/analytics/subscriptions/${id}`)).data;
export const getDebtProjection = async (params) => (await api.get('/analytics/debt_projection', { params })).data;
export const getAnomalies = async () => (await api.get('/analytics/anomalies')).data;

// Goals
export const getGoals = async () => (await api.get('/goals/')).data;
export const createGoal = async (goal) => (await api.post('/goals/', goal)).data;
export const updateGoal = async (id, data) => (await api.put(`/goals/${id}`, data)).data;
export const deleteGoal = async (id) => (await api.delete(`/goals/${id}`)).data;

// Accounts
export const getAccounts = async () => (await api.get('/net-worth/accounts')).data;
export const createAccount = async (data) => (await api.post('/net-worth/accounts', data)).data;
export const updateAccount = async (id, data) => (await api.put(`/net-worth/accounts/${id}`, data)).data;
export const deleteAccount = async (id) => (await api.delete(`/net-worth/accounts/${id}`)).data;

// Net Worth Import/Export
export const downloadNetWorthTemplate = async () => {
    const response = await api.get('/net-worth/template', { responseType: 'blob' });
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'net_worth_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

// --- Members ---
export const getMembers = async () => {
    const response = await api.get('/settings/members');
    return response.data;
};

export const createMember = async (memberData) => {
    const response = await api.post('/settings/members', memberData);
    return response.data;
};

export const updateMember = async ({ id, data }) => {
    const response = await api.put(`/settings/members/${id}`, data);
    return response.data;
};

export const deleteMember = async (id) => {
    const response = await api.delete(`/settings/members/${id}`);
    return response.data;
};

export const createBucket = async (bucket) => {
    const response = await api.post('/settings/buckets', bucket);
    return response.data;
};

export const updateBucket = async (id, bucket) => {
    const response = await api.put(`/settings/buckets/${id}`, bucket);
    return response.data;
};

export const deleteBucket = async (id) => {
    const response = await api.delete(`/settings/buckets/${id}`);
    return response.data;
};

export const reorderBuckets = async (orderData) => {
    const response = await api.post('/settings/buckets/reorder', orderData);
    return response.data;
};

// Rules
export const getRules = async () => {
    const response = await api.get('/settings/rules/');
    return response.data;
};

export const createRule = async (data) => {
    const response = await api.post('/settings/rules/', data);
    return response.data;
};

export const updateRule = async (id, data) => {
    const response = await api.put(`/settings/rules/${id}`, data);
    return response.data;
};

export const deleteRule = async (id) => {
    const response = await api.delete(`/settings/rules/${id}`);
    return response.data;
};

export const bulkDeleteRules = async (ids) => {
    const response = await api.post('/settings/rules/bulk-delete', ids);
    return response.data;
};

export const splitTransaction = async (id, items) => {
    const response = await api.post(`/transactions/${id}/split`, { items });
    return response.data;
};

export const deleteAllTransactions = async () => {
    const response = await api.delete('/transactions/all');
    return response.data;
};

export const runRules = async (overwrite = false) => {
    const response = await api.post(`/settings/rules/run?overwrite_verified=${overwrite}`);
    return response.data;
};

export const previewRule = async (keywords, minAmount = null, maxAmount = null) => {
    const response = await api.post('/settings/rules/preview', {
        keywords,
        min_amount: minAmount,
        max_amount: maxAmount,
        limit: 5
    });
    return response.data;
};

export const reorderRules = async (ruleIds) => {
    const response = await api.put('/settings/rules/reorder', { rule_ids: ruleIds });
    return response.data;
};

// Holdings
export const getHoldings = async (accountId) => (await api.get(`/net-worth/accounts/${accountId}/holdings`)).data;
export const createHolding = async (accountId, holding) => (await api.post(`/net-worth/accounts/${accountId}/holdings`, holding)).data;
export const updateHolding = async (holdingId, holding) => (await api.put(`/net-worth/holdings/${holdingId}`, holding)).data;
export const deleteHolding = async (holdingId) => (await api.delete(`/net-worth/holdings/${holdingId}`)).data;
export const refreshHoldingPrices = async () => (await api.post(`/net-worth/holdings/refresh-prices`)).data;
export const getInvestmentHistory = async () => (await api.get('/investments/history')).data;

// Market
export const searchTicker = async (query) => (await api.get(`/market/search?q=${query}`)).data;
export const getQuote = async (ticker) => (await api.get(`/market/quote?ticker=${ticker}`)).data;

// Notifications
export const getNotifications = async (unreadOnly = false) => {
    const res = await api.get('/notifications/', { params: { unread_only: unreadOnly } });
    return res.data;
};

export const markNotificationRead = async (id) => {
    const res = await api.post(`/notifications/${id}/read`);
    return res.data;
};

export const markAllNotificationsRead = async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
};

export const deleteNotification = async (id) => {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
};

// Upcoming Bills
export const getUpcomingBills = async (days = 7) => {
    const res = await api.get('/notifications/upcoming-bills', { params: { days } });
    return res.data;
};

// Notification Settings
export const getNotificationSettings = async () => {
    const res = await api.get('/settings/notifications');
    return res.data;
};

export const updateNotificationSettings = async (settings) => {
    const res = await api.put('/settings/notifications', settings);
    return res.data;
};

// AI Chat
export const chatWithAI = async (question) => {
    const res = await api.post('/analytics/chat', { question });
    return res.data;
};

// Savings Opportunities
export const getSavingsOpportunities = async () => {
    const res = await api.get('/analytics/savings-opportunities');
    return res.data;
};

// Auth Management
export const updatePassword = async (data) => {
    const res = await api.post('/auth/change-password', data);
    return res.data;
};

export const logoutAllSessions = async () => {
    const res = await api.post('/auth/logout-all');
    return res.data;
};

export const deleteUserAccount = async (password) => {
    const res = await api.delete('/auth/account', { data: { password } });
    return res.data;
};

// Cash Flow Forecast
export const getCashFlowForecast = async (days = 90) => {
    const res = await api.get('/analytics/forecast', { params: { days } });
    return res.data;
};

export default api;
