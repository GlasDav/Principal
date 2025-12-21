import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Lock, Mail, TrendingUp } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || "/";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
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
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (tokenResponse) => {
        setIsGoogleLoading(true);
        setError("");
        try {
            // tokenResponse.access_token is the OAuth access token
            await googleLogin(tokenResponse.access_token);
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Google login error:', err);
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError("Failed to sign in with Google. Please try again.");
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const googleLoginHook = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: (error) => {
            console.error('Google OAuth error:', error);
            setError("Google sign-in was cancelled or failed.");
        },
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md relative z-10">
                {/* Logo and branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
                        <TrendingUp className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent mb-2">Principal</h1>
                    <p className="text-slate-300/80">Take control of your finances</p>
                </div>

                {error && (
                    <div className="bg-red-500/20 backdrop-blur text-red-200 p-3 rounded-xl mb-6 text-sm text-center border border-red-500/30">
                        {error}
                    </div>
                )}

                {/* Google Login Button */}
                <button
                    type="button"
                    onClick={() => googleLoginHook()}
                    disabled={isGoogleLoading}
                    className="w-full bg-white/10 backdrop-blur border border-white/20 text-white font-medium py-3 rounded-xl transition-all hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGoogleLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Signing in...
                        </>
                    ) : (
                        <>
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                            Sign in with Google
                        </>
                    )}
                </button>

                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/20"></div>
                    <span className="text-sm text-slate-400">Or continue with email</span>
                    <div className="flex-1 h-px bg-white/20"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-400 transition-colors" size={20} />
                            <input
                                type="email"
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-400 transition-colors" size={20} />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mt-2 text-right">
                            <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                        Sign up for free
                    </Link>
                </div>

                <div className="mt-4 text-center text-xs text-slate-500">
                    <Link to="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
                    {' · '}
                    <Link to="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link>
                </div>
            </div>
        </div>
    );
}
