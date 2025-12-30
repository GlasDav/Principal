import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Calendar, Shield, Users, Plus, Trash2, Copy, Check, Home, Edit2, X } from 'lucide-react';
import api from '../../services/api';

export default function AccountSettings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [householdName, setHouseholdName] = useState('');

    // Fetch household data
    const { data: household } = useQuery({
        queryKey: ['household'],
        queryFn: async () => {
            const res = await api.get('/household');
            return res.data;
        },
    });

    const createHouseholdMutation = useMutation({
        mutationFn: async (name) => {
            const res = await api.post('/household', { name });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['household']);
        },
    });

    const updateHouseholdMutation = useMutation({
        mutationFn: async (data) => {
            const res = await api.put('/household', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['household']);
            setEditingName(false);
        },
    });

    const inviteMemberMutation = useMutation({
        mutationFn: async (email) => {
            const res = await api.post('/household/invite', { email });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['household']);
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: async (userId) => {
            await api.delete(`/household/members/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['household']);
        },
    });

    const leaveHouseholdMutation = useMutation({
        mutationFn: async () => {
            await api.post('/household/leave');
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['household']);
        },
    });

    const handleCopyInviteLink = () => {
        if (household?.invite_code) {
            const inviteUrl = `${window.location.origin}/join/${household.invite_code}`;
            navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCreateHousehold = () => {
        const name = prompt('Enter a name for your household:', 'My Family');
        if (name && name.trim()) {
            createHouseholdMutation.mutate(name.trim());
        }
    };

    const handleSaveName = () => {
        if (householdName.trim() && householdName.trim() !== household?.name) {
            updateHouseholdMutation.mutate({ name: householdName.trim() });
        } else {
            setEditingName(false);
        }
    };

    const startEditingName = () => {
        setHouseholdName(household?.name || '');
        setEditingName(true);
    };

    if (!user) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-slate-500">No user information available</p>
            </div>
        );
    }

    const accountCreatedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Unknown';

    return (
        <div className="space-y-6">
            {/* Account Information Section */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <User size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Account Information</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your profile and account details</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Email */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">
                            <Mail size={18} className="text-slate-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                            <p className="text-slate-800 dark:text-slate-100 font-medium mt-1">{user.email || 'Not set'}</p>
                        </div>
                    </div>

                    {/* Username */}
                    {user.username && (
                        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">
                                <User size={18} className="text-slate-500" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Username</label>
                                <p className="text-slate-800 dark:text-slate-100 font-medium mt-1">{user.username}</p>
                            </div>
                        </div>
                    )}

                    {/* Account Created */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">
                            <Calendar size={18} className="text-slate-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Member Since</label>
                            <p className="text-slate-800 dark:text-slate-100 font-medium mt-1">{accountCreatedDate}</p>
                        </div>
                    </div>

                    {/* Account Status */}
                    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">
                            <Shield size={18} className="text-emerald-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Status</label>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <p className="text-slate-800 dark:text-slate-100 font-medium">Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> To update your email address or username, please contact support or use the security settings.
                    </p>
                </div>
            </section>

            {/* Family Sharing Section */}
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Home size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Family Sharing</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Share your budget with family members</p>
                    </div>
                </div>

                {!household ? (
                    <div className="text-center py-8">
                        <Home size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Household Yet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Create a household to share budgets and collaborate with family members
                        </p>
                        <button
                            onClick={handleCreateHousehold}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2 mx-auto"
                        >
                            <Plus size={18} />
                            Create Household
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Household Info */}
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    {editingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={householdName}
                                                onChange={(e) => setHouseholdName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveName();
                                                    if (e.key === 'Escape') setEditingName(false);
                                                }}
                                                className="flex-1 px-3 py-1.5 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSaveName}
                                                className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                                                title="Save"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => setEditingName(false)}
                                                className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                                                title="Cancel"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{household.name}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    {household.members?.length || 0} member{household.members?.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <button
                                                onClick={startEditingName}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                                                title="Edit household name"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {household.invite_code && !editingName && (
                                    <button
                                        onClick={handleCopyInviteLink}
                                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 transition"
                                    >
                                        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                        {copied ? 'Copied!' : 'Copy Invite Link'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Members List */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Members</h3>
                                <button
                                    onClick={() => {
                                        const email = prompt('Enter email address to invite:');
                                        if (email) inviteMemberMutation.mutate(email);
                                    }}
                                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Invite Member
                                </button>
                            </div>

                            <div className="space-y-2">
                                {household.members?.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                                <User size={16} className="text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                                    {member.email}
                                                    {member.id === user.id && (
                                                        <span className="ml-2 text-xs text-slate-400">(You)</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {member.role || 'Member'}
                                                </p>
                                            </div>
                                        </div>
                                        {member.id !== user.id && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Remove this member from the household?')) {
                                                        removeMemberMutation.mutate(member.id);
                                                    }
                                                }}
                                                className="text-slate-400 hover:text-red-500 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Leave Household */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to leave this household?')) {
                                        leaveHouseholdMutation.mutate();
                                    }
                                }}
                                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                            >
                                Leave Household
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
