import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || "/";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); // Clear previous errors
        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError("Invalid credentials. Please check your email and password.");
            }
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const mockToken = "mock_google_token";
            await googleLogin(mockToken);
            navigate(from, { replace: true });
        } catch (err) {
            setError("Google login is not yet available. Please use email login.");
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">My Principal</h1>
                    <p className="text-slate-500 dark:text-slate-400">Welcome back! Please enter your details.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center border border-red-100">
                        {error}
                    </div>
                )}

                {/* Google Login Button */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white font-medium py-2.5 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center gap-2 mb-6"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    Sign in with Google
                </button>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">Or continue with email</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="email"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        Sign In
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-indigo-600 font-bold hover:text-indigo-700">
                        Sign up for free
                    </Link>
                </div>

                <div className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    <Link to="/privacy" className="hover:text-indigo-500">Privacy Policy</Link>
                    {' · '}
                    <Link to="/terms" className="hover:text-indigo-500">Terms of Service</Link>
                </div>
            </div>
        </div>
    );
}
