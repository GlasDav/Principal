import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Lock, Mail, TrendingUp, Play } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

// Demo account credentials
const DEMO_EMAIL = "demo@dollardata.app";
const DEMO_PASSWORD = "demo123";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isDemoLoading, setIsDemoLoading] = useState(false);
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

    const handleDemoLogin = async () => {
        setError("");
        setIsDemoLoading(true);
        try {
            await login(DEMO_EMAIL, DEMO_PASSWORD);
            navigate("/", { replace: true });
        } catch (err) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError("Demo account not available. Please try again later.");
            }
        } finally {
            setIsDemoLoading(false);
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
        <div className="min-h-screen bg-surface dark:bg-surface-dark flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-light/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-card dark:bg-card-dark p-8 rounded-3xl shadow-2xl border border-border dark:border-border-dark w-full max-w-md relative z-10 transition-colors duration-300">
                {/* Logo and branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg shadow-primary/30">
                        <TrendingUp className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">DollarData</h1>
                    <p className="text-text-muted">Take control of your finances</p>
                </div>

                {error && (
                    <div className="bg-accent-error/20 text-accent-error p-3 rounded-xl mb-6 text-sm text-center border border-accent-error/30">
                        {error}
                    </div>
                )}

                {/* Try Demo Button - Prominent CTA */}
                {/* Try Demo Button - Prominent CTA */}
                <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={isDemoLoading}
                    className="w-full bg-accent-success hover:bg-accent-success/90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDemoLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading demo...
                        </>
                    ) : (
                        <>
                            <Play size={18} fill="currentColor" />
                            Try Demo - No Sign Up Required
                        </>
                    )}
                </button>

                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-border dark:bg-border-dark"></div>
                    <span className="text-xs text-text-muted">or sign in</span>
                    <div className="flex-1 h-px bg-border dark:bg-border-dark"></div>
                </div>

                {/* Google Login Button */}
                <button
                    type="button"
                    onClick={() => googleLoginHook()}
                    disabled={isGoogleLoading}
                    className="w-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text-primary dark:text-text-primary-dark font-medium py-3 rounded-xl transition-all hover:bg-surface-hover dark:hover:bg-surface-dark-hover hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex-1 h-px bg-border dark:bg-border-dark"></div>
                    <span className="text-sm text-text-muted">Or continue with email</span>
                    <div className="flex-1 h-px bg-border dark:bg-border-dark"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3 text-text-muted group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="email"
                                className="w-full pl-10 pr-4 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-text-primary dark:text-text-primary-dark placeholder-text-muted/50"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3 text-text-muted group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-3 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-text-primary dark:text-text-primary-dark placeholder-text-muted/50"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mt-2 text-right">
                            <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-hover transition-colors">
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div className="mt-8 text-center text-sm text-text-muted">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-primary font-semibold hover:text-primary-hover transition-colors">
                        Sign up for free
                    </Link>
                </div>

                <div className="mt-4 text-center text-xs text-text-muted/80">
                    <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                    {' · '}
                    <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                </div>
            </div>
        </div>
    );
}
