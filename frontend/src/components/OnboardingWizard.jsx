import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, DollarSign, Users, ArrowRight, Check, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { updateSettings, createMember } from '../services/api';
import Button from './ui/Button';

export default function OnboardingWizard() {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(1);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Check if we should show the wizard
    const { data: transactions } = useQuery({
        queryKey: ['transactions', 'check-new'],
        queryFn: async () => (await api.get('/transactions/', { params: { limit: 1 } })).data,
        staleTime: 60000
    });

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

        // If never seen AND no data loaded yet (assuming new user)
        if (!hasSeenOnboarding) {
            // Slight delay for smooth entrance
            const timer = setTimeout(() => {
                // Only show if we confirm no transactions exist (meaning likely new user)
                if (transactions && transactions.total === 0) {
                    setIsOpen(true);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [transactions]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('hasSeenOnboarding', 'true');
    };

    const handleFinish = () => {
        handleClose();
        navigate('/data-management');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">

                {/* Progress Bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 w-full">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-in-out"
                        style={{ width: `${(step / 3) * 100}%` }}
                    ></div>
                </div>

                {/* Content Area */}
                <div className="p-8 flex-1 flex flex-col text-center items-center justify-center min-h-[320px]">

                    {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
                    {step === 2 && <HouseholdStep onNext={() => setStep(3)} />}
                    {step === 3 && <ConnectStep onFinish={handleFinish} />}

                </div>
            </div>
        </div>
    );
}

// Step 1: Welcome
function WelcomeStep({ onNext }) {
    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto transform rotate-3">
                <Sparkles className="text-white" size={40} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome to Principal</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Your personal finance command center. Let's get you set up in just a few clicks.
                </p>
            </div>
            <Button variant="primary" size="lg" onClick={onNext} className="w-full max-w-xs">
                Get Started <ArrowRight size={18} />
            </Button>
        </div>
    );
}

// Step 2: Currency
function CurrencyStep({ onNext }) {
    const queryClient = useQueryClient();
    const [currency, setCurrency] = useState('$');
    const [loading, setLoading] = useState(false);

    const updateCurrency = async () => {
        setLoading(true);
        try {
            await updateSettings({ currency_symbol: currency });
            await queryClient.invalidateQueries(['userSettings']);
            onNext();
        } catch (e) {
            console.error(e);
            alert("Failed to save currency. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6 w-full max-w-xs">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <DollarSign size={32} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select Currency</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Choose the primary symbol for your dashboard.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {['$', '€', '£', '¥', '₹', 'A$'].map(sym => (
                    <button
                        key={sym}
                        onClick={() => setCurrency(sym)}
                        className={`py-3 rounded-xl border-2 font-bold text-lg transition-all ${currency === sym
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 text-slate-600 dark:text-slate-400'
                            }`}
                    >
                        {sym}
                    </button>
                ))}
            </div>

            <Button variant="primary" size="lg" onClick={updateCurrency} disabled={loading} className="w-full">
                {loading ? 'Saving...' : 'Continue'}
            </Button>
        </div>
    );
}

// Step 3: Household
function HouseholdStep({ onNext }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const onSkip = () => onNext();

    const addMember = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            await createMember({ name, color: '#ec4899', avatar: 'User' }); // Default pink for partner
            await queryClient.invalidateQueries(['members']);
            onNext();
        } catch (e) {
            console.error(e);
            alert("Failed to add member.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6 w-full max-w-xs">
            <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto text-pink-600 dark:text-pink-400">
                <Users size={32} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Add a Partner?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Tracking finances with someone? Add their name to categorize spending easily.
                </p>
            </div>

            <div className="space-y-3">
                <input
                    type="text"
                    placeholder="Partner's Name (Optional)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                />
            </div>

            <div className="space-y-3">
                <Button variant="primary" size="lg" onClick={addMember} disabled={!name.trim() || loading} className="w-full">
                    {loading ? 'Adding...' : 'Add & Continue'}
                </Button>
                <button onClick={onSkip} className="text-slate-400 hover:text-slate-600 text-sm font-medium transition">
                    Skip / I'm Solo
                </button>
            </div>
        </div>
    );
}

// Step 4: Connect
function ConnectStep({ onFinish }) {
    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto">
                <UploadCloud className="text-white" size={40} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">You're All Set!</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    The best way to start is by importing your data. We support CSVs and bank statements.
                </p>
            </div>
            <Button variant="primary" size="lg" onClick={onFinish} className="w-full max-w-xs">
                Import Data Now <ArrowRight size={18} />
            </Button>
        </div>
    );
}
