import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { TrendingUp, CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../services/api';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link. No token provided.');
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await api.post('/auth/verify-email', { token });
                setStatus('success');
                setMessage(response.data.message);
            } catch (err) {
                setStatus('error');
                const detail = err.response?.data?.detail;
                if (typeof detail === 'string') {
                    setMessage(detail);
                } else {
                    setMessage('Verification failed. The link may have expired.');
                }
            }
        };

        verifyEmail();
    }, [token]);

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
                        Email Verification
                    </h1>
                </div>

                {status === 'loading' && (
                    <div className="text-center py-8">
                        <Loader className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
                        <p className="text-slate-300">Verifying your email...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-6">
                        <div className="bg-green-500/20 backdrop-blur text-green-200 p-6 rounded-xl text-center border border-green-500/30">
                            <CheckCircle className="w-12 h-12 mx-auto mb-3" />
                            <h2 className="text-xl font-bold mb-2">Email Verified!</h2>
                            <p className="text-green-300/70 text-sm">{message}</p>
                        </div>
                        <Link
                            to="/"
                            className="flex items-center justify-center w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/30"
                        >
                            Go to Dashboard →
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="space-y-6">
                        <div className="bg-red-500/20 backdrop-blur text-red-200 p-6 rounded-xl text-center border border-red-500/30">
                            <XCircle className="w-12 h-12 mx-auto mb-3" />
                            <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
                            <p className="text-red-300/70 text-sm">{message}</p>
                        </div>
                        <Link
                            to="/login"
                            className="flex items-center justify-center w-full bg-white/10 backdrop-blur border border-white/20 text-white font-medium py-3 rounded-xl transition-all hover:bg-white/20"
                        >
                            Back to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
