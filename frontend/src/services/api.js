import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Response Interceptor for Global Error Handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized (Token Expired)
        if (error.response && error.response.status === 401) {
            // Only redirect if not already on auth pages
            if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
                console.warn("Session expired. Redirecting to login.");
                // Clear any local storage/cookies if necessary (AuthContext usually handles this via state, but a hard redirect is a safety net)
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

export const splitTransaction = async (id, items) => {
    const response = await api.post(`/transactions/${id}/split`, { items });
    return response.data;
};

export const runRules = async () => {
    const response = await api.post('/settings/rules/run');
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

export default api;
