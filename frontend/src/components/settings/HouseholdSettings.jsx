import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users, UserPlus, Crown, Shield, User, Mail, Trash2,
    Copy, Check, Loader2, LogOut, Settings
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

const API_URL = API_BASE_URL;

// API calls
const getHousehold = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch household');
    return response.json();
};

const updateHousehold = async (data) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update household');
    return response.json();
};

const inviteMember = async (data) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household/invite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to invite member');
    }
    return response.json();
};

const removeMember = async (userId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to remove member');
    return response.json();
};

const updateMemberRole = async ({ userId, role }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household/members/${userId}/role`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
    });
    if (!response.ok) throw new Error('Failed to update role');
    return response.json();
};

const cancelInvite = async (inviteId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to cancel invite');
    return response.json();
};

const leaveHousehold = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/household/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to leave household');
    }
    return response.json();
};

const RoleIcon = ({ role }) => {
    switch (role) {
        case 'owner': return <Crown size={14} className="text-amber-500" />;
        case 'admin': return <Shield size={14} className="text-primary" />;
        default: return <User size={14} className="text-text-muted" />;
    }
};

export default function HouseholdSettings() {
    const queryClient = useQueryClient();
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteError, setInviteError] = useState(null);
    const [editingName, setEditingName] = useState(false);
    const [householdName, setHouseholdName] = useState('');

    const { data: household, isLoading } = useQuery({
        queryKey: ['household'],
        queryFn: getHousehold
    });

    const updateMutation = useMutation({
        mutationFn: updateHousehold,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['household'] });
            setEditingName(false);
        }
    });

    const inviteMutation = useMutation({
        mutationFn: inviteMember,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['household'] });
            setShowInviteModal(false);
            setInviteError(null);
        },
        onError: (err) => {
            setInviteError(err.message);
        }
    });

    const removeMutation = useMutation({
        mutationFn: removeMember,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] })
    });

    const updateRoleMutation = useMutation({
        mutationFn: updateMemberRole,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] })
    });

    const cancelInviteMutation = useMutation({
        mutationFn: cancelInvite,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] })
    });

    const leaveMutation = useMutation({
        mutationFn: leaveHousehold,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['household'] });
            // Optionally refresh page or redirect
        }
    });

    const handleInvite = (e) => {
        e.preventDefault();
        const form = e.target;
        inviteMutation.mutate({
            email: form.email.value,
            role: form.role.value
        });
    };

    const currentUserRole = household?.members?.find(m => m.user_id === household?.owner_id)?.role;
    const isOwner = household?.owner_id && household.members?.some(m => m.role === 'owner');

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-text-primary dark:text-text-primary-dark">Family Sharing</h3>
                    <p className="text-sm text-text-muted mt-1">
                        Manage your household and share financial data with family members.
                    </p>
                </div>
            </div>

            {/* Household Info */}
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark p-6">
                <div className="flex items-center justify-between mb-4">
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={householdName}
                                onChange={(e) => setHouseholdName(e.target.value)}
                                className="px-3 py-1 border border-border dark:border-border-dark rounded-lg bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark"
                                autoFocus
                            />
                            <button
                                onClick={() => updateMutation.mutate({ name: householdName })}
                                className="px-3 py-1 bg-primary text-white rounded-lg text-sm"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setEditingName(false)}
                                className="px-3 py-1 text-text-muted hover:text-text-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Users size={24} className="text-primary" />
                            <div>
                                <h4 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">
                                    {household?.name}
                                </h4>
                                <p className="text-sm text-text-muted">
                                    {household?.members?.length || 0} member{household?.members?.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setHouseholdName(household?.name || '');
                                    setEditingName(true);
                                }}
                                className="ml-2 text-text-muted hover:text-text-secondary"
                                title="Edit name"
                            >
                                <Settings size={16} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition"
                    >
                        <UserPlus size={16} />
                        Invite Member
                    </button>
                </div>

                {/* Members List */}
                <div className="space-y-2">
                    <h5 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">Members</h5>
                    {household?.members?.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg group">
                            <div className="flex items-center gap-3">
                                <RoleIcon role={member.role} />
                                <div>
                                    <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                        {member.user_name || member.user_email}
                                    </span>
                                    {member.user_name && (
                                        <span className="text-sm text-text-muted ml-2">
                                            {member.user_email}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs bg-card dark:bg-card-dark text-text-secondary dark:text-text-secondary-dark px-2 py-0.5 rounded capitalize">
                                    {member.role}
                                </span>
                            </div>
                            {member.role !== 'owner' && (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <select
                                        value={member.role}
                                        onChange={(e) => updateRoleMutation.mutate({ userId: member.user_id, role: e.target.value })}
                                        className="text-xs border border-border dark:border-border-dark rounded px-2 py-1 bg-card dark:bg-card-dark text-text-primary dark:text-text-primary-dark"
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            if (confirm(`Remove ${member.user_name || member.user_email} from household?`)) {
                                                removeMutation.mutate(member.user_id);
                                            }
                                        }}
                                        className="text-text-muted hover:text-accent-error p-1"
                                        title="Remove member"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Pending Invites */}
                {household?.pending_invites?.length > 0 && (
                    <div className="mt-6">
                        <h5 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-2">Pending Invites</h5>
                        {household.pending_invites.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-2">
                                <div className="flex items-center gap-3">
                                    <Mail size={16} className="text-amber-600" />
                                    <span className="text-text-primary dark:text-text-primary-dark">{invite.email}</span>
                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => cancelInviteMutation.mutate(invite.id)}
                                    className="text-text-muted hover:text-accent-error text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Leave Household */}
                {household?.members?.length > 1 && (
                    <div className="mt-6 pt-4 border-t border-border dark:border-border-dark">
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to leave this household?')) {
                                    leaveMutation.mutate();
                                }
                            }}
                            disabled={leaveMutation.isPending}
                            className="flex items-center gap-2 text-accent-error hover:text-accent-error/80 text-sm"
                        >
                            <LogOut size={16} />
                            Leave Household
                        </button>
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card dark:bg-card-dark rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-4">
                            Invite Family Member
                        </h3>
                        {inviteError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-accent-error rounded-lg text-sm">
                                {inviteError}
                            </div>
                        )}
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                    Email Address
                                </label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="family@example.com"
                                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                    Role
                                </label>
                                <select
                                    name="role"
                                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark"
                                >
                                    <option value="member">Member - Can view and edit data</option>
                                    <option value="admin">Admin - Can also manage members</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowInviteModal(false);
                                        setInviteError(null);
                                    }}
                                    className="px-4 py-2 text-text-muted hover:bg-surface dark:hover:bg-surface-dark rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviteMutation.isPending}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg disabled:opacity-50"
                                >
                                    {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
