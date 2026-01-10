import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Calendar, Shield, Users, Plus, Trash2, Copy, Check, Home, Edit2, X } from 'lucide-react';
import api, { getMembers, createMember, updateMember, deleteMember } from '../../services/api';

// Preset color palette for member colors
const COLOR_PALETTE = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
];

const ColorPicker = ({ currentColor, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: currentColor || '#6366f1',
                    border: '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    padding: 0,
                }}
                title="Change member color"
            />

            {isOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: 'var(--color-slate-800, #1e293b)',
                        border: '1px solid var(--color-slate-700, #334155)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        zIndex: 50,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '6px',
                        width: '102px',
                    }}>
                        {COLOR_PALETTE.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    onChange(color);
                                    setIsOpen(false);
                                }}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    border: currentColor === color ? '2px solid white' : 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                                title={color}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// Member Card with editable name and color
const MemberCard = ({ member, updateMemberMutation, deleteMemberMutation, isOnlyMember }) => {
    const [localName, setLocalName] = useState(member.name);

    useEffect(() => {
        setLocalName(member.name);
    }, [member.name]);

    const handleNameBlur = () => {
        if (localName !== member.name && localName.trim()) {
            updateMemberMutation.mutate({ id: member.id, data: { ...member, name: localName.trim() } });
        }
    };

    return (
        <div className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
            <div className="flex items-center gap-3 flex-1">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: member.color || '#6366f1' }}
                >
                    {member.name.charAt(0).toUpperCase()}
                </div>
                <input
                    className="font-medium text-text-primary dark:text-text-primary-dark bg-transparent border-b border-transparent hover:border-text-muted dark:hover:border-text-muted-dark focus:border-primary outline-none transition px-1 flex-1 text-sm"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                />
            </div>
            <div className="flex items-center gap-2">
                <ColorPicker
                    currentColor={member.color}
                    onChange={(color) => updateMemberMutation.mutate({ id: member.id, data: { ...member, color } })}
                />
                {!isOnlyMember && (
                    <button
                        onClick={() => {
                            if (confirm("Delete this member? Budget limits associated with them will be removed.")) {
                                deleteMemberMutation.mutate(member.id);
                            }
                        }}
                        className="text-text-muted hover:text-accent-error transition p-1"
                        title="Delete member"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default function AccountSettings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);


    // Fetch household data
    const { data: household } = useQuery({
        queryKey: ['household'],
        queryFn: async () => {
            const res = await api.get('/household');
            return res.data;
        },
    });

    // Fetch spender members (household members for budget tracking)
    const { data: spenderMembers = [] } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers,
    });

    // Spender member mutations
    const createSpenderMemberMutation = useMutation({
        mutationFn: createMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
    });

    const updateSpenderMemberMutation = useMutation({
        mutationFn: updateMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
    });

    const deleteSpenderMemberMutation = useMutation({
        mutationFn: deleteMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
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

    if (!user) {
        return (
            <div className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark">
                <p className="text-text-muted">No user information available</p>
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
            <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light rounded-lg">
                        <User size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Account Information</h2>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Your profile and account details</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Email */}
                    <div className="flex items-start gap-4 p-4 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                        <div className="p-2 bg-card dark:bg-card-dark rounded-lg">
                            <Mail size={18} className="text-text-muted" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Email Address</label>
                            <p className="text-text-primary dark:text-text-primary-dark font-medium mt-1">{user.email || 'Not set'}</p>
                        </div>
                    </div>

                    {/* Username */}
                    {user.username && (
                        <div className="flex items-start gap-4 p-4 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                            <div className="p-2 bg-card dark:bg-card-dark rounded-lg">
                                <User size={18} className="text-text-muted" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Username</label>
                                <p className="text-text-primary dark:text-text-primary-dark font-medium mt-1">{user.username}</p>
                            </div>
                        </div>
                    )}

                    {/* Account Created */}
                    <div className="flex items-start gap-4 p-4 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                        <div className="p-2 bg-card dark:bg-card-dark rounded-lg">
                            <Calendar size={18} className="text-text-muted" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Member Since</label>
                            <p className="text-text-primary dark:text-text-primary-dark font-medium mt-1">{accountCreatedDate}</p>
                        </div>
                    </div>

                    {/* Account Status */}
                    <div className="flex items-start gap-4 p-4 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                        <div className="p-2 bg-card dark:bg-card-dark rounded-lg">
                            <Shield size={18} className="text-accent-success" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Account Status</label>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 bg-accent-success rounded-full"></div>
                                <p className="text-text-primary dark:text-text-primary-dark font-medium">Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg">
                    <p className="text-sm text-primary dark:text-primary-light">
                        <strong>Note:</strong> To update your email address or username, please contact support or use the security settings.
                    </p>
                </div>
            </section>

            {/* Family Sharing Section */}
            <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light rounded-lg">
                        <Home size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Family Sharing</h2>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Share your budget with family members</p>
                    </div>
                </div>

                {!household ? (
                    <div className="p-8 text-center bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-text-muted">Loading family sharing...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Shared Access List */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Shared Access</h3>
                                <div className="flex items-center gap-2">
                                    {household.invite_code && (
                                        <button
                                            onClick={handleCopyInviteLink}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg text-xs font-medium hover:bg-surface dark:hover:bg-surface-dark transition text-text-primary dark:text-text-primary-dark"
                                        >
                                            {copied ? <Check size={14} className="text-accent-success" /> : <Copy size={14} />}
                                            {copied ? 'Copied Link' : 'Copy Invite Link'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            const email = prompt('Enter email address to invite:');
                                            if (email) inviteMemberMutation.mutate(email);
                                        }}
                                        className="text-sm text-primary dark:text-primary-light hover:text-primary-hover dark:hover:text-primary-hover font-medium flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Invite Member
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {/* Always show current user first */}
                                {(!household.members || !household.members.some(m => m.id === user.id)) && (
                                    <div className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                                                <User size={16} className="text-primary dark:text-primary-light" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                                    {user.email}
                                                    <span className="ml-2 text-xs text-text-muted">(You)</span>
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    Owner
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {household.members?.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                                                <User size={16} className="text-primary dark:text-primary-light" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                                    {member.email}
                                                    {member.id === user.id && (
                                                        <span className="ml-2 text-xs text-text-muted">(You)</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    {member.id === user.id ? 'Owner' : (member.role || 'Member')}
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
                                                className="text-text-muted hover:text-accent-error transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Spending Profiles Section */}
                        <div className="pt-4 border-t border-border dark:border-border-dark">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Spending Profiles</h3>
                                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
                                        Track spending by person (e.g., you, partner, kids)
                                    </p>
                                </div>
                                <button
                                    onClick={() => createSpenderMemberMutation.mutate({ name: "New Member", color: "#6366f1", avatar: "User" })}
                                    className="text-sm text-primary dark:text-primary-light hover:text-primary-hover dark:hover:text-primary-hover font-medium flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Add Member
                                </button>
                            </div>

                            <div className="space-y-2">
                                {spenderMembers.map((member) => (
                                    <MemberCard
                                        key={member.id}
                                        member={member}
                                        updateMemberMutation={updateSpenderMemberMutation}
                                        deleteMemberMutation={deleteSpenderMemberMutation}
                                        isOnlyMember={spenderMembers.length <= 1}
                                    />
                                ))}
                                {spenderMembers.length === 0 && (
                                    <p className="text-sm text-text-muted italic py-3 text-center bg-surface dark:bg-surface-dark rounded-lg">
                                        No members yet. Add a member to track individual spending.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Leave Household */}
                        <div className="pt-4 border-t border-border dark:border-border-dark">
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to leave this household?')) {
                                        leaveHouseholdMutation.mutate();
                                    }
                                }}

                                className="text-sm text-accent-error hover:text-accent-error/80 font-medium"
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
