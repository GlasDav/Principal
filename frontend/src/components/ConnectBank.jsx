import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Shield, CheckCircle, Loader2, X, Plus } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import api from '../services/api';

const BASIQ_SCRIPT_ID = 'basiq-connect-script';

export default function ConnectBank({ onConnectSuccess }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mockStep, setMockStep] = useState('idle'); // idle, selecting, consenting, connecting, success
    const queryClient = useQueryClient();
    const containerRef = useRef(null);

    // Fetch Token
    const { data: tokenData, isLoading: tokenLoading, error: tokenError } = useQuery({
        queryKey: ['connectionToken'],
        queryFn: async () => (await api.get('/connections/token')).data,
        enabled: isOpen,
        retry: false,
        staleTime: 0 // Always fetch fresh
    });

    // Validating token type
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
    };

    const handleMockFlow = () => {
        // Simulate the user journey
        setMockStep('selecting');
        setTimeout(() => setMockStep('consenting'), 1500);
        setTimeout(() => setMockStep('connecting'), 3000);
        setTimeout(() => {
            setMockStep('success');
            syncMutation.mutate("mock_job_id_123");
        }, 5000);
    };

    // Load Basiq Script
    useEffect(() => {
        if (!document.getElementById(BASIQ_SCRIPT_ID)) {
            const script = document.createElement('script');
            script.id = BASIQ_SCRIPT_ID;
            script.src = 'https://js.basiq.io/index.js'; // Check correct URL
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    // Initialize Basiq or Mock
    useEffect(() => {
        if (isOpen && tokenData) {
            if (isMock) {
                if (mockStep === 'idle') handleMockFlow();
            } else {
                // Real Basiq Flow
                // Wait for script to load if needed
                const initBasiq = () => {
                    if (window.Basiq && containerRef.current) {
                        try {
                            window.Basiq.render({
                                token: tokenData.access_token,
                                container: containerRef.current,
                                action: "connect",
                                onSuccess: (result) => {
                                    console.log("Basiq Success:", result);
                                    // result usually has { jobId: "job_..." }
                                    // Or sometimes it's nested. Assume result.jobId based on common patterns.
                                    // We will send the full ID string.
                                    // If result is just ID? Let's log it.
                                    const jobId = result?.id || result?.jobId || (typeof result === 'string' ? result : null);
                                    if (jobId) {
                                        setMockStep('connecting'); // Re-use step for showing loader
                                        syncMutation.mutate(jobId);
                                    } else {
                                        alert("Connection successful but no Job ID returned.");
                                    }
                                },
                                onCancel: () => {
                                    setIsOpen(false);
                                },
                                onError: (err) => {
                                    console.error("Basiq Error:", err);
                                    alert("Connection Error: " + (err.message || "Unknown error"));
                                }
                            });
                        } catch (e) {
                            console.error("Failed to render Basiq:", e);
                        }
                    } else {
                        setTimeout(initBasiq, 500); // Retry if script not ready
                    }
                };
                initBasiq();
            }
        }
    }, [isOpen, tokenData, isMock]);

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
                    <Dialog.Panel className={`w-full ${isMock ? 'max-w-md' : 'max-w-2xl'} bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden`}>

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
                        <div className="min-h-[400px] flex flex-col relative">
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

                            {/* Real Basiq Container */}
                            {!isMock && isOpen && tokenData && (
                                <div
                                    id="basiq-container"
                                    ref={containerRef}
                                    className="w-full h-[600px] bg-white"
                                >
                                    {/* Basiq UI renders here */}
                                </div>
                            )}

                            {/* Mock UI Overlay / Fallback */}
                            {isMock && (
                                <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                                    {/* ... Existing Mock UI code ... */}
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

                            {/* Shared Syncing State for Real Mode too */}
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
