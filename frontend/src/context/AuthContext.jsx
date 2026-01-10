import React, { createContext, useState, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();

    // Initialize Auth State & Listen for Changes
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSession(session);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSession = async (session) => {
        if (session) {
            const accessToken = session.access_token;
            setToken(accessToken);
            api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
            localStorage.setItem("token", accessToken); // Keep for compatibility if needed, but Supabase handles persist

            // Fetch full profile from backend (legacy user data)
            try {
                const res = await api.get("/auth/users/me");
                setUser(res.data);
            } catch (error) {
                console.error("Failed to fetch user profile", error);
                // Fallback to basic Supabase user info if backend fails
                setUser({
                    email: session.user.email,
                    name: session.user.user_metadata?.name,
                    id: session.user.id
                });
            }
        } else {
            setToken(null);
            setUser(null);
            delete api.defaults.headers.common["Authorization"];
            localStorage.removeItem("token");
            queryClient.clear();
        }
        setLoading(false);
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const register = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });
        if (error) throw error;
        // Supabase auto-logins if email confirmation is disabled or if configured to do so
        return data;
    };

    const googleLogin = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback` // Ensure this route exists or backend handles it
            }
        });
        if (error) throw error;
        return data;
    };

    const resetPassword = async (email) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        return data;
    };

    const updatePassword = async (newPassword) => {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
        return data;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        // State updates handled by onAuthStateChange
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, register, googleLogin, resetPassword, updatePassword, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
