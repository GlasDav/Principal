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
        <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark rounded-lg">
                    <Shield size={20} />
                </div>
                <div>
                    <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Security</h2>
                    <p className="text-sm text-text-muted">Manage your account security</p>
                </div>
            </div>

            {/* Change Password */}
            <div className="max-w-md">
                <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-4 flex items-center gap-2">
                    <Key size={16} /> Change Password
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            placeholder="Current Password"
                            className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-sm"
                            value={passwordData.current}
                            onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="New Password"
                            className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-sm"
                            value={passwordData.new}
                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-sm"
                            value={passwordData.confirm}
                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                            required
                        />
                    </div>

                    {error && <p className="text-xs text-accent-error">{error}</p>}
                    {message && <p className="text-xs text-accent-success flex items-center gap-1"><CheckCircle size={12} /> {message}</p>}

                    <button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
                    >
                        {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>

            <hr className="border-border dark:border-border-dark" />

            {/* MFA Placeholder */}
            <div>
                <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2 flex items-center gap-2">
                    <Smartphone size={16} /> Multi-Factor Authentication
                </h3>
                <div className="flex items-center justify-between p-4 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                    <div>
                        <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Two-Factor Authentication (2FA)</p>
                        <p className="text-xs text-text-muted">Secure your account with an additional verification step.</p>
                    </div>
                    <button
                        className="px-3 py-1.5 text-xs font-medium bg-muted dark:bg-muted-dark text-text-muted rounded-lg cursor-not-allowed"
                        disabled
                    >
                        Coming Soon
                    </button>
                </div>
            </div>

            <hr className="border-border dark:border-border-dark" />

            {/* Sessions */}
            <div>
                <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2 flex items-center gap-2">
                    <Lock size={16} /> Session Management
                </h3>
                <div className="flex items-center justify-between p-4 bg-accent-warning/10 rounded-lg border border-accent-warning/20">
                    <div>
                        <p className="text-sm font-medium text-accent-warning">Log out of all devices</p>
                        <p className="text-xs text-accent-warning">This will terminate all active sessions except this one.</p>
                    </div>
                    <button
                        onClick={() => {
                            if (confirm("Are you sure you want to log out of all other devices?")) logoutAllMutation.mutate();
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-card dark:bg-card-dark text-accent-warning border border-accent-warning/20 rounded-lg hover:bg-accent-warning/10 transition shadow-sm"
                    >
                        Log Out All
                    </button>
                </div>
            </div>

            <hr className="border-border dark:border-border-dark" />

            {/* Delete Account - Danger Zone */}
            <div>
                <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2 flex items-center gap-2">
                    <Trash2 size={16} /> Delete Account
                </h3>
                <div className="flex items-center justify-between p-4 bg-accent-error/10 rounded-lg border border-accent-error/20">
                    <div>
                        <p className="text-sm font-medium text-accent-error">Permanently delete your account</p>
                        <p className="text-xs text-accent-error">This action cannot be undone. All your data will be permanently deleted.</p>
                    </div>
                    <button
                        onClick={handleDeleteAccount}
                        className="px-3 py-1.5 text-xs font-medium bg-accent-error text-white rounded-lg hover:bg-accent-error-hover transition shadow-sm flex items-center gap-1.5"
                    >
                        <Trash2 size={14} />
                        Delete My Account
                    </button>
                </div>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card dark:bg-card-dark rounded-xl shadow-2xl max-w-md w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border dark:border-border-dark">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent-error/10 text-accent-error rounded-lg">
                                    <AlertTriangle size={20} />
                                </div>
                                <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                                    {deleteStep === 1 ? 'Delete Account?' : 'Confirm Deletion'}
                                </h2>
                            </div>
                            <button
                                onClick={handleDeleteCancel}
                                className="p-1 hover:bg-surface dark:hover:bg-surface-dark rounded transition"
                            >
                                <X size={20} className="text-text-muted" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {deleteStep === 1 ? (
                                <>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        You are about to permanently delete your account. This will:
                                    </p>
                                    <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-2 list-disc list-inside">
                                        <li>Delete all your transactions and financial data</li>
                                        <li>Remove all budget categories and rules</li>
                                        <li>Delete all accounts and investment holdings</li>
                                        <li>Remove your goals and net worth history</li>
                                    </ul>
                                    <div className="bg-accent-error/10 border border-accent-error/20 rounded-lg p-3">
                                        <p className="text-sm font-medium text-accent-error flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            This action cannot be undone!
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        Please enter your password to confirm account deletion:
                                    </p>
                                    <input
                                        type="password"
                                        placeholder="Enter your password"
                                        className="w-full px-3 py-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-error"
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
                                        <p className="text-xs text-accent-error flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {deleteError}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-border dark:border-border-dark">
                            <button
                                onClick={handleDeleteCancel}
                                className="px-4 py-2 text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark rounded-lg transition"
                                disabled={deleteAccountMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteAccountMutation.isPending}
                                className="px-4 py-2 bg-accent-error text-white text-sm font-medium rounded-lg hover:bg-accent-error-hover transition disabled:opacity-50 flex items-center gap-2"
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
