import React, { createContext, useState, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken"));
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();

    // Set api default header whenever token changes
    useEffect(() => {
        if (token) {
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            localStorage.setItem("token", token);
        } else {
            delete api.defaults.headers.common["Authorization"];
            localStorage.removeItem("token");
        }
    }, [token]);

    // Persist refresh token
    useEffect(() => {
        if (refreshToken) {
            localStorage.setItem("refreshToken", refreshToken);
        } else {
            localStorage.removeItem("refreshToken");
        }
    }, [refreshToken]);

    // Check if user is logged in (fetch profile)
    useEffect(() => {
        const fetchUser = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                // Fetch user profile from backend using shared api instance
                const res = await api.get("/auth/users/me");
                setUser(res.data);
            } catch (error) {
                console.error("Failed to fetch user profile", error);
                // If 401, the api interceptor will handle refresh/redirect
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [token]);

    const login = async (username, password) => {
        const params = new URLSearchParams();
        params.append("username", username);
        params.append("password", password);

        const res = await api.post("/auth/token", params);
        setToken(res.data.access_token);
        setRefreshToken(res.data.refresh_token);
        setUser({ username });
    };

    const register = async (email, password, name) => {
        await api.post("/auth/register", {
            email,
            password,
            name
        });
        // Auto login after register
        await login(email, password);
    };

    const googleLogin = async (googleToken) => {
        const res = await api.post("/auth/google", { token: googleToken });
        setToken(res.data.access_token);
        setRefreshToken(res.data.refresh_token);
    };

    const logout = () => {
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        // Clear all cached data to prevent stale data for next user
        queryClient.removeQueries();
    };

    return (
        <AuthContext.Provider value={{ user, token, refreshToken, login, logout, register, googleLogin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
