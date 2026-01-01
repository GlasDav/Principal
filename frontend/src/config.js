/**
 * Centralized configuration for the frontend application.
 */

// API Base URL
// 1. Env Var: Use VITE_API_URL if defined (e.g. for local dev pointing to a specific backend)
// 2. Default: Use relative path '/api' (standard for production behind Nginx)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
