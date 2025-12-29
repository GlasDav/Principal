import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Shield, CheckCircle, Loader2, X, Plus } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import api from '../services/api';

export default function ConnectBank({ onConnectSuccess }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mockStep, setMockStep] = useState('idle');
    const [connectionError, setConnectionError] = useState(null);
    const queryClient = useQueryClient();
    const basiqRef = useRef(null);

    // Fetch Token
    const { data: tokenData, isLoading: tokenLoading, error: tokenError } = useQuery({
        queryKey: ['connectionToken'],
        queryFn: async () => (await api.get('/connections/token')).data,
        enabled: isOpen,
        retry: false,
        staleTime: 0
    });

    const isMock = tokenData?.access_token?.startsWith("mock_");

    // Sync Mutation
    const syncMutation = useMutation({
        mutationFn: async (jobId) => {
            const res = await api.post('/connections/sync', { job_id: jobId });
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['accounts']);
            queryClient.invalidateQueries(['transactions']);
            if (onConnectSuccess) onConnectSuccess(data);
            setTimeout(() => {
                setMockStep('idle');
                setIsOpen(false);
            }, 2000);
        }
    });

    const handleConnect = () => {
        setIsOpen(true);
        setConnectionError(null);
    };

    const handleMockFlow = () => {
        setMockStep('selecting');
        setTimeout(() => setMockStep('consenting'), 1500);
        setTimeout(() => setMockStep('connecting'), 3000);
        setTimeout(() => {
            setMockStep('success');
            syncMutation.mutate("mock_job_id_123");
        }, 5000);
    };

    // Initialize Basiq Connect SDK (embedded widget)
    useEffect(() => {
        if (!isMock && tokenData?.access_token && !basiqRef.current) {
            // Load Basiq Connect SDK
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@basiq/connect-auth@latest/dist/basiq-connect.umd.js';
            script.async = true;
            script.onload = () => {
                // Initialize Basiq Connect
                if (window.BasiqConnect) {
                    basiqRef.current = new window.BasiqConnect({
                        token: tokenData.access_token,
                        onSuccess: (result) => {
                            console.log('Basiq connection success:', result);
                            // result contains jobId
                            if (result.jobId) {
                                syncMutation.mutate(result.jobId);
                            }
                        },
                        onError: (error) => {
                            console.error('Basiq connection error:', error);
                            setConnectionError(error.message || 'Connection failed');
                        },
                        onCancel: () => {
                            console.log('User cancelled Basiq connection');
                            setIsOpen(false);
                        }
                    });

                    // Open the widget
                    basiqRef.current.open();
                }
            };
            document.body.appendChild(script);

            return () => {
                if (basiqRef.current) {
                    basiqRef.current.close();
                    basiqRef.current = null;
                }
            };
        }
    }, [tokenData, isMock]);

    // Mock flow
    useEffect(() => {
        if (isOpen && tokenData && isMock && mockStep === 'idle') {
            handleMockFlow();
        }
    }, [isOpen, tokenData, isMock, mockStep]);

    return (
        <>
            <button
                onClick={handleConnect}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm"
            >
                <Plus size={20} />
                Connect Bank
            </button>

            <Dialog open={isOpen} onClose={() => { if (mockStep !== 'connecting' && !syncMutation.isPending) setIsOpen(false); }} className="relative z-50">
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">

                        {/* Header */}
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Building className="text-indigo-600" size={20} />
                                Connect Financial Institution
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="min-h-[300px] flex flex-col relative">
                            {tokenLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-800/80 z-20">
                                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                                    <p className="text-slate-500">Initializing Secure Connection...</p>
                                </div>
                            )}

                            {tokenError && (
                                <div className="p-8 text-center text-red-500">
                                    <p>Failed to initialize connection.</p>
                                    <p className="text-xs mt-1">{tokenError.response?.data?.detail || tokenError.message}</p>
                                </div>
                            )}

                            {connectionError && (
                                <div className="p-8 text-center text-red-500">
                                    <p>Connection failed.</p>
                                    <p className="text-xs mt-1">{connectionError}</p>
                                </div>
                            )}

                            {/* Real Basiq - Widget loads automatically */}
                            {!isMock && tokenData && !tokenLoading && !connectionError && (
                                <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                                    <Shield size={64} className="mx-auto text-green-500 mb-4" />
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Opening Basiq Connect...</h4>
                                    <p className="text-sm text-slate-500 mt-2">
                                        The secure bank connection widget should open automatically.
                                    </p>
                                    <p className="text-xs text-slate-400 mt-4">
                                        Powered by Basiq · Bank-grade security · CDR compliant
                                    </p>
                                </div>
                            )}

                            {/* Mock UI */}
                            {isMock && (
                                <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                                    <div className="space-y-6 w-full">
                                        {mockStep === 'selecting' && (
                                            <div className="animate-in fade-in zoom-in duration-500">
                                                <Building size={64} className="mx-auto text-slate-300 mb-4" />
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Select Your Bank</h4>
                                                <div className="mt-4 space-y-2">
                                                    <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg w-full animate-pulse" />
                                                    <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg w-full animate-pulse delay-75" />
                                                    <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg w-full animate-pulse delay-150" />
                                                </div>
                                            </div>
                                        )}
                                        {mockStep === 'consenting' && (
                                            <div className="animate-in fade-in slide-in-from-right duration-500">
                                                <Shield size={64} className="mx-auto text-green-500 mb-4" />
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Secure Data Sharing</h4>
                                                <p className="text-sm text-slate-500 mt-2">You are securely sharing your data via Basiq.</p>
                                                <div className="mt-6">
                                                    <button className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold">I Consent</button>
                                                </div>
                                            </div>
                                        )}
                                        {mockStep === 'connecting' && (
                                            <div className="animate-in fade-in duration-500">
                                                <Loader2 size={64} className="mx-auto text-indigo-600 animate-spin mb-4" />
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Syncing Accounts...</h4>
                                                <p className="text-sm text-slate-500 mt-2">Retrieving your transactions history.</p>
                                            </div>
                                        )}
                                        {(mockStep === 'success' || (mockStep === 'connecting' && syncMutation.isSuccess)) && (
                                            <div className="animate-in fade-in zoom-in duration-500">
                                                <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Connected!</h4>
                                                <p className="text-sm text-slate-500 mt-2">
                                                    {syncMutation.data ?
                                                        `Synced ${syncMutation.data.synced_accounts} accounts and ${syncMutation.data.synced_transactions} transactions.` :
                                                        "Redirecting..."}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 p-2 text-center border-t border-amber-100 dark:border-amber-900/30 rounded w-full">
                                        <p className="text-xs text-amber-600 dark:text-amber-500 font-mono">
                                            [MOCK MODE] Simulating Basiq flow.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Syncing State */}
                            {!isMock && (syncMutation.isPending || syncMutation.isSuccess) && (
                                <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col items-center justify-center z-30">
                                    {syncMutation.isPending ? (
                                        <>
                                            <Loader2 size={64} className="mx-auto text-indigo-600 animate-spin mb-4" />
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Syncing with Bank...</h4>
                                            <p className="text-sm text-slate-500 mt-2">This may take up to 30 seconds.</p>
                                        </>
                                    ) : (
                                        <div className="animate-in fade-in zoom-in duration-500 text-center">
                                            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Successfully Connected!</h4>
                                            <p className="text-sm text-slate-500 mt-2">
                                                Synced {syncMutation.data?.synced_accounts} accounts.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </>
    );
}
