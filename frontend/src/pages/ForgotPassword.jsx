import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, TrendingUp, ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSubmitted(true);
        } catch (err) {
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else {
                setError("An error occurred. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md relative z-10">
                {/* Logo and branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-violet-500/30">
                        <TrendingUp className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent mb-2">
                        Reset Password
                    </h1>
                    <p className="text-slate-300/80">
                        {submitted
                            ? "Check your email for instructions"
                            : "Enter your email to receive a reset link"
                        }
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/20 backdrop-blur text-red-200 p-3 rounded-xl mb-6 text-sm text-center border border-red-500/30">
                        {error}
                    </div>
                )}

                {submitted ? (
                    <div className="space-y-6">
                        <div className="bg-green-500/20 backdrop-blur text-green-200 p-4 rounded-xl text-sm text-center border border-green-500/30">
                            <p className="mb-2">✓ Password reset email sent!</p>
                            <p className="text-green-300/70 text-xs">
                                If an account exists with this email, you'll receive a link to reset your password.
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 w-full bg-white/10 backdrop-blur border border-white/20 text-white font-medium py-3 rounded-xl transition-all hover:bg-white/20"
                        >
                            <ArrowLeft size={18} />
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-violet-400 transition-colors" size={20} />
                                <input
                                    type="email"
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-white placeholder-slate-500"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Sending...
                                </span>
                            ) : 'Send Reset Link'}
                        </button>

                        <div className="text-center">
                            <Link
                                to="/login"
                                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                            >
                                ← Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
