import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    // Set axios default header whenever token changes
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`; // Keep global for safety
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`; // Set on shared instance
            localStorage.setItem("token", token);
        } else {
            delete axios.defaults.headers.common["Authorization"];
            delete api.defaults.headers.common["Authorization"];
            localStorage.removeItem("token");
        }
    }, [token]);

    // Check if user is logged in (fetch profile)
    useEffect(() => {
        const fetchUser = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                // Fetch user profile from backend
                const res = await axios.get("http://localhost:8000/auth/users/me");
                setUser(res.data);
            } catch (error) {
                console.error("Failed to fetch user profile", error);
                logout(); // invalid token
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [token]);

    const login = async (username, password) => {
        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);

        const res = await axios.post("http://localhost:8000/auth/token", formData);
        setToken(res.data.access_token);
        // Could fetch user details here and setUser
        setUser({ username }); // Simple state
    };

    const register = async (email, password) => {
        await axios.post("http://localhost:8000/auth/register", {
            email,
            password
        });
        // Auto login after register
        await login(email, password);
    };

    const googleLogin = async (token) => {
        // Mock or Real call
        const res = await axios.post("http://localhost:8000/auth/google", { token });
        setToken(res.data.access_token);
        // setUser handled by useEffect
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, register, googleLogin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
