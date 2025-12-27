import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, AlertCircle, Building } from 'lucide-react';
import api from '../services/api';

/**
 * BasiqCallback Page
 * 
 * This page handles the return from Basiq's consent UI.
 * After a user completes bank consent on consent.basiq.io,
 * they are redirected back here with connection details.
 * 
 * URL Parameters Basiq may return:
 * - connectionId: The ID of the created connection
 * - jobId: The ID of the sync job
 * - status: 'success' or 'error'
 * - error: Error message if something went wrong
 */
export default function BasiqCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    const [status, setStatus] = useState('processing'); // processing, syncing, success, error
    const [message, setMessage] = useState('Processing your bank connection...');
    const [error, setError] = useState(null);

    // Sync mutation to import data from the connected bank
    const syncMutation = useMutation({
        mutationFn: async (jobId) => {
            const res = await api.post('/connections/sync', { job_id: jobId });
            return res.data;
        },
        onSuccess: (data) => {
            setStatus('success');
            setMessage(`Successfully synced ${data.synced_accounts || 0} accounts and ${data.synced_transactions || 0} transactions!`);
            queryClient.invalidateQueries(['accounts']);
            queryClient.invalidateQueries(['transactions']);

            // Redirect to data management after a delay
            setTimeout(() => {
                navigate('/data-management', { replace: true });
            }, 3000);
        },
        onError: (err) => {
            setStatus('error');
            setError(err.response?.data?.detail || err.message || 'Failed to sync bank data');
        }
    });

    useEffect(() => {
        // Get parameters from URL
        const connectionId = searchParams.get('connectionId');
        const jobId = searchParams.get('jobId');
        const urlStatus = searchParams.get('status');
        const urlError = searchParams.get('error');

        // Check for explicit error from Basiq
        if (urlStatus === 'error' || urlError) {
            setStatus('error');
            setError(urlError || 'Connection was cancelled or failed');
            return;
        }

        // If we have a jobId, trigger the sync
        if (jobId) {
            setStatus('syncing');
            setMessage('Syncing your bank accounts and transactions...');
            syncMutation.mutate(jobId);
            return;
        }

        // If we have a connectionId but no jobId, we might need to poll for the job
        if (connectionId) {
            setStatus('syncing');
            setMessage('Setting up your bank connection...');
            // Use connectionId as the job ID for now - backend can handle either
            syncMutation.mutate(connectionId);
            return;
        }

        // No valid parameters - show error
        setStatus('error');
        setError('No connection data received. Please try connecting again.');
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
                {/* Header */}
                <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Building className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Connection</h1>
                </div>

                {/* Status Content */}
                <div className="text-center py-8">
                    {/* Processing/Syncing State */}
                    {(status === 'processing' || status === 'syncing') && (
                        <div className="animate-in fade-in duration-300">
                            <Loader2 size={64} className="mx-auto text-indigo-600 animate-spin mb-4" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                {status === 'syncing' ? 'Syncing Your Data' : 'Processing'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">{message}</p>
                            {status === 'syncing' && (
                                <p className="text-xs text-slate-400 mt-4">
                                    This may take up to 30 seconds...
                                </p>
                            )}
                        </div>
                    )}

                    {/* Success State */}
                    {status === 'success' && (
                        <div className="animate-in fade-in zoom-in duration-500">
                            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Connection Successful!
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">{message}</p>
                            <p className="text-xs text-slate-400">
                                Redirecting to Data Management...
                            </p>
                        </div>
                    )}

                    {/* Error State */}
                    {status === 'error' && (
                        <div className="animate-in fade-in duration-300">
                            <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Connection Failed
                            </h2>
                            <p className="text-red-500 dark:text-red-400 mb-6">{error}</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => navigate('/data-management')}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition"
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
                    <p className="text-xs text-center text-slate-400">
                        Powered by Basiq · Bank-grade security · CDR compliant
                    </p>
                </div>
            </div>
        </div>
    );
}
