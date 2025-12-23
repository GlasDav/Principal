import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch, Menu } from '@headlessui/react';
import { Trash2, Plus, Download, Moon, Sun, DollarSign, Euro, PoundSterling, Save, Upload, Wallet, ShoppingCart, Tag as TagIcon, Home, Utensils, Zap, Car, Film, Heart, ShoppingBag, Briefcase, Coffee, Gift, Music, Smartphone, Plane, Play, TrendingUp, PiggyBank, Landmark, ChevronRight, ChevronDown, CornerDownRight, Users } from 'lucide-react';
import * as api from '../services/api';
import { ICON_MAP, DEFAULT_ICON } from '../utils/icons';
import { useTheme } from '../context/ThemeContext';

// Currency Code to Symbol Map
const CURRENCY_MAP = {
    'USD': '$',
    'AUD': '$',
    'GBP': '£',
    'EUR': '€',
    'JPY': '¥',
    'INR': '₹',
    'CAD': '$',
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const cleanKeywords = (str) => {
    if (!str) return "";
    return [...new Set(str.split(',').map(k => k.trim()).filter(k => k))].join(', ');
};

const AccountCard = ({ account, updateAccountMutation, deleteAccountMutation }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${account.type === 'Asset' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {(() => {
                        const c = (account.category || '').toLowerCase();
                        if (c.includes('real estate') || c.includes('property')) return <Home size={20} />;
                        if (c.includes('investment')) return <TrendingUp size={20} />;
                        if (c.includes('loan')) return <Landmark size={20} />;
                        if (account.type === 'Asset') return <Wallet size={20} />;
                        return <ShoppingCart size={20} />;
                    })()}
                </div>

                <div className="flex flex-col flex-1 gap-1">
                    <input
                        className="font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition px-1"
                        value={account.name}
                        onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, name: e.target.value } })}
                    />
                    <div className="flex gap-2">
                        <select
                            className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none cursor-pointer hover:text-indigo-500"
                            value={account.type}
                            onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, type: e.target.value } })}
                        >
                            <option value="Asset">Asset</option>
                            <option value="Liability">Liability</option>
                        </select>
                        <span className="text-xs text-slate-300">|</span>
                        <select
                            className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none cursor-pointer hover:text-indigo-500"
                            value={account.category}
                            onChange={(e) => updateAccountMutation.mutate({ id: account.id, data: { ...account, category: e.target.value } })}
                        >
                            <option value="Cash">Cash</option>
                            <option value="Investment">Investment</option>
                            <option value="Real Estate">Real Estate</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Loan">Loan</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={() => {
                        if (confirm("Delete this account?")) deleteAccountMutation.mutate(account.id);
                    }}
                    className="text-slate-300 hover:text-red-400 transition self-start"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

export default function Settings() {
    const { theme, toggleTheme } = useTheme();
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [importStatus, setImportStatus] = useState(null);

    // Queries
    const { data: userSettings, isLoading: settingsLoading } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
    const { data: accounts = [], isLoading: accountsLoading } = useQuery({ queryKey: ['accounts'], queryFn: api.getAccounts });

    // Mutations for Settings
    const updateSettingsMutation = useMutation({
        mutationFn: api.updateSettings,
        onSuccess: () => {
            queryClient.invalidateQueries(['settings']);
        },
    });

    // Mutations for Accounts
    const createAccountMutation = useMutation({
        mutationFn: api.createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
        },
    });

    const updateAccountMutation = useMutation({
        mutationFn: ({ id, data }) => api.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
        },
    });

    const deleteAccountMutation = useMutation({
        mutationFn: api.deleteAccount,
        onSuccess: () => {
            queryClient.invalidateQueries(['accounts']);
        },
    });

    // Handlers
    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImportStatus("Importing...");
        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.importTransactions(formData);
            setImportStatus("Import successful!");
            queryClient.invalidateQueries(['transactions']);
            setTimeout(() => setImportStatus(null), 3000);
        } catch (error) {
            console.error(error);
            setImportStatus(`Error: ${error.message}`);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await api.exportData();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `principal_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed");
        }
    };

    // Couple Mode Handlers
    const handleCoupleToggle = (checked) => {
        updateSettingsMutation.mutate({ ...userSettings, is_couple_mode: checked });
    };

    if (settingsLoading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Settings</h1>

            {/* Appearance Section */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Moon size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Appearance</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Manage theme and visual preferences</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                        {theme === 'dark' ? <Moon size={18} className="text-indigo-500" /> : <Sun size={18} className="text-orange-500" />}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark Mode</span>
                    </div>
                    <Switch
                        checked={theme === 'dark'}
                        onChange={toggleTheme}
                        className={`${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                        <span className={`${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                </div>
            </section>

            {/* General Preferences */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Preferences</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Currency and Couple Mode</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Currency */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency Symbol</label>
                            <select
                                className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-500"
                                value={userSettings?.currency_symbol || 'USD'}
                                onChange={(e) => updateSettingsMutation.mutate({ ...userSettings, currency_symbol: e.target.value })}
                            >
                                {Object.keys(CURRENCY_MAP).map(code => (
                                    <option key={code} value={code}>{code} ({CURRENCY_MAP[code]})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Couple Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Users size={18} className="text-purple-500" />
                            <div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">Couple Mode</span>
                                <span className="text-xs text-slate-400">Enable split limits (User A / User B) for categories</span>
                            </div>
                        </div>
                        <Switch
                            checked={userSettings?.is_couple_mode || false}
                            onChange={handleCoupleToggle}
                            className={`${userSettings?.is_couple_mode ? 'bg-purple-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                        >
                            <span className={`${userSettings?.is_couple_mode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </Switch>
                    </div>

                    {/* Couple Names - Only if enabled */}
                    {userSettings?.is_couple_mode && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">User A Name</label>
                                <input
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    value={userSettings?.name_a || ''}
                                    onChange={(e) => updateSettingsMutation.mutate({ ...userSettings, name_a: e.target.value })}
                                    placeholder="e.g. David"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">User B Name</label>
                                <input
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    value={userSettings?.name_b || ''}
                                    onChange={(e) => updateSettingsMutation.mutate({ ...userSettings, name_b: e.target.value })}
                                    placeholder="e.g. Partner"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Accounts Management */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <Landmark size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Accounts</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Manage assets and liabilities</p>
                        </div>
                    </div>
                    <button
                        onClick={() => createAccountMutation.mutate({ name: "New Account", type: "Asset", category: "Cash" })}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                    >
                        <Plus size={16} />
                        Add Account
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accounts.map(acc => (
                        <AccountCard
                            key={acc.id}
                            account={acc}
                            updateAccountMutation={updateAccountMutation}
                            deleteAccountMutation={deleteAccountMutation}
                        />
                    ))}
                    {accounts.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                            No accounts added yet.
                        </div>
                    )}
                </div>
            </section>

            {/* Data Management */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                        <Save size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Data Management</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Import/Export your financial data</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    {/* Export */}
                    <button
                        onClick={handleExport}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                    >
                        <Download size={18} className="text-slate-400 group-hover:text-indigo-500 transition" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Export JSON</span>
                    </button>

                    {/* Import */}
                    <div className="flex-1 relative">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition group"
                        >
                            <Upload size={18} className="text-slate-400 group-hover:text-indigo-500 transition" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {importStatus || "Import JSON"}
                            </span>
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
