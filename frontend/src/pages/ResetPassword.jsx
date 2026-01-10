import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, TrendingUp, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const { updatePassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }

        setIsLoading(true);
        try {
            await updatePassword(password);
            setSuccess(true);
            // Redirect to login after 3 seconds
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            console.error("Password reset error:", err);
            setError(err.message || "Failed to reset password. The session may have expired.");
        } finally {
            setIsLoading(false);
        }
    };

    // Note: Supabase automatically recovers the session from the URL fragment
    // We assume the AuthProvider has initialized the session by the time user interacts.

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
                        Set New Password
                    </h1>
                    <p className="text-slate-300/80">
                        {success ? "Password reset successful!" : "Choose a strong password"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/20 backdrop-blur text-red-200 p-3 rounded-xl mb-6 text-sm text-center border border-red-500/30">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="space-y-6">
                        <div className="bg-green-500/20 backdrop-blur text-green-200 p-4 rounded-xl text-center border border-green-500/30">
                            <CheckCircle className="mx-auto mb-2" size={32} />
                            <p className="font-medium">Password Reset Successful!</p>
                            <p className="text-green-300/70 text-sm mt-1">
                                Redirecting to login...
                            </p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-violet-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-white placeholder-slate-500"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                At least 8 characters, including a letter and a number
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-violet-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-white placeholder-slate-500"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
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
                                    Resetting...
                                </span>
                            ) : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
