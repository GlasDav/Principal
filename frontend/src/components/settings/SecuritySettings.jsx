import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Key, Lock, LogOut, CheckCircle, Smartphone, Trash2, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../services/api';

export default function SecuritySettings() {
    const navigate = useNavigate();
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [mfaEnabled, setMfaEnabled] = useState(false); // Placeholder state

    // Delete Account States
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteStep, setDeleteStep] = useState(1); // 1 = warning, 2 = password confirmation
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState(null);

    const changePasswordMutation = useMutation({
        mutationFn: (data) => api.updatePassword({
            current_password: data.current,
            new_password: data.new
        }),
        onSuccess: () => {
            setMessage("Password changed successfully!");
            setPasswordData({ current: '', new: '', confirm: '' });
            setTimeout(() => setMessage(null), 3000);
        },
        onError: (err) => {
            setError(err.response?.data?.detail || "Failed to change password");
            setTimeout(() => setError(null), 3000);
        }
    });

    const logoutAllMutation = useMutation({
        mutationFn: api.logoutAllSessions,
        onSuccess: () => {
            alert("All other sessions have been logged out.");
        }
    });

    const deleteAccountMutation = useMutation({
        mutationFn: (password) => api.deleteUserAccount(password),
        onSuccess: () => {
            // Clear all local storage and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            navigate('/login', { replace: true });
        },
        onError: (err) => {
            setDeleteError(err.response?.data?.detail || "Failed to delete account");
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            setError("New passwords do not match");
            return;
        }
        if (passwordData.new.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        changePasswordMutation.mutate(passwordData);
    };

    const handleDeleteAccount = () => {
        setShowDeleteModal(true);
        setDeleteStep(1);
        setDeletePassword('');
        setDeleteError(null);
    };

    const handleDeleteConfirm = () => {
        if (deleteStep === 1) {
            setDeleteStep(2);
        } else {
            if (!deletePassword) {
                setDeleteError("Password is required");
                return;
            }
            deleteAccountMutation.mutate(deletePassword);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setDeleteStep(1);
        setDeletePassword('');
        setDeleteError(null);
    };

    return (
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                    <Shield size={20} />
                </div>
                <div>
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">Security</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage your account security</p>
                </div>
            </div>

            {/* Change Password */}
            <div className="max-w-md">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <Key size={16} /> Change Password
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            placeholder="Current Password"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            value={passwordData.current}
                            onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="New Password"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            value={passwordData.new}
                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            value={passwordData.confirm}
                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                            required
                        />
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}
                    {message && <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle size={12} /> {message}</p>}

                    <button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* MFA Placeholder */}
            <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Smartphone size={16} /> Multi-Factor Authentication
                </h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Two-Factor Authentication (2FA)</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Secure your account with an additional verification step.</p>
                    </div>
                    <button
                        className="px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg cursor-not-allowed"
                        disabled
                    >
                        Coming Soon
                    </button>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Sessions */}
            <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Lock size={16} /> Session Management
                </h3>
                <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                    <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Log out of all devices</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">This will terminate all active sessions except this one.</p>
                    </div>
                    <button
                        onClick={() => {
                            if (confirm("Are you sure you want to log out of all other devices?")) logoutAllMutation.mutate();
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition shadow-sm"
                    >
                        Log Out All
                    </button>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Delete Account - Danger Zone */}
            <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <Trash2 size={16} /> Delete Account
                </h3>
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-200">Permanently delete your account</p>
                        <p className="text-xs text-red-700 dark:text-red-400">This action cannot be undone. All your data will be permanently deleted.</p>
                    </div>
                    <button
                        onClick={handleDeleteAccount}
                        className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm flex items-center gap-1.5"
                    >
                        <Trash2 size={14} />
                        Delete My Account
                    </button>
                </div>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                                    <AlertTriangle size={20} />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                    {deleteStep === 1 ? 'Delete Account?' : 'Confirm Deletion'}
                                </h2>
                            </div>
                            <button
                                onClick={handleDeleteCancel}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {deleteStep === 1 ? (
                                <>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        You are about to permanently delete your account. This will:
                                    </p>
                                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside">
                                        <li>Delete all your transactions and financial data</li>
                                        <li>Remove all budget categories and rules</li>
                                        <li>Delete all accounts and investment holdings</li>
                                        <li>Remove your goals and net worth history</li>
                                    </ul>
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                        <p className="text-sm font-medium text-red-900 dark:text-red-200 flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            This action cannot be undone!
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        Please enter your password to confirm account deletion:
                                    </p>
                                    <input
                                        type="password"
                                        placeholder="Enter your password"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        value={deletePassword}
                                        onChange={(e) => {
                                            setDeletePassword(e.target.value);
                                            setDeleteError(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleDeleteConfirm();
                                        }}
                                        autoFocus
                                    />
                                    {deleteError && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {deleteError}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={handleDeleteCancel}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                disabled={deleteAccountMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteAccountMutation.isPending}
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {deleteAccountMutation.isPending ? (
                                    <>Deleting...</>
                                ) : deleteStep === 1 ? (
                                    <>Continue</>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        Permanently Delete Account
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
