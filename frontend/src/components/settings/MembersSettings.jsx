import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Check } from 'lucide-react';
import * as api from '../../services/api';

// Preset color palette
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
            {/* Current Color Button */}
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

            {/* Color Palette Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Color Grid - 3x3 */}
                    <div className="absolute right-0 mt-2 p-2 bg-popover dark:bg-popover-dark border border-border dark:border-border-dark rounded-lg shadow-lg z-50 grid grid-cols-3 gap-1.5 w-[102px]">
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

const MemberCard = ({ member, updateMemberMutation, deleteMemberMutation }) => {
    // Local state for name to avoid API call on every keystroke
    const [localName, setLocalName] = useState(member.name);

    // Sync local state when member prop changes (e.g., after refetch)
    useEffect(() => {
        setLocalName(member.name);
    }, [member.name]);

    const handleNameBlur = () => {
        // Only update if name actually changed
        if (localName !== member.name && localName.trim()) {
            updateMemberMutation.mutate({ id: member.id, data: { ...member, name: localName.trim() } });
        }
    };

    return (
        <div className="bg-card dark:bg-card-dark p-4 rounded-xl shadow-sm border border-border dark:border-border-dark space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div
                    className="p-2 rounded-lg text-white"
                    style={{ backgroundColor: member.color || '#6366f1' }}
                >
                    <Users size={20} />
                </div>

                <div className="flex flex-col flex-1 gap-1">
                    <div className="flex items-center gap-2">
                        <input
                            className="font-semibold text-text-primary dark:text-text-primary-dark bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition px-1 flex-1"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-medium">Theme</span>
                    <ColorPicker
                        currentColor={member.color}
                        onChange={(color) => updateMemberMutation.mutate({ id: member.id, data: { ...member, color } })}
                    />
                </div>

                <button
                    onClick={() => {
                        if (confirm("Delete this member? Limits associated with them will be removed.")) deleteMemberMutation.mutate(member.id);
                    }}
                    className="text-text-muted hover:text-accent-error transition self-start"
                >
                    <Trash2 size={16} />
                </button>
            </div >
        </div >
    );
};

export default function MembersSettings() {
    const queryClient = useQueryClient();
    const { data: members = [], isLoading } = useQuery({ queryKey: ['members'], queryFn: api.getMembers });

    const createMemberMutation = useMutation({
        mutationFn: api.createMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
    });

    const updateMemberMutation = useMutation({
        mutationFn: api.updateMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
    });

    const deleteMemberMutation = useMutation({
        mutationFn: api.deleteMember,
        onSuccess: () => queryClient.invalidateQueries(['members']),
    });

    if (isLoading) return <div className="p-4">Loading members...</div>;

    return (
        <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <Users size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Household Members</h2>
                        <p className="text-sm text-text-muted">Manage people in your household for budgeting</p>
                    </div>
                </div>
                <button
                    onClick={() => createMemberMutation.mutate({ name: "New Member", color: "#6366f1", avatar: "User" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition"
                >
                    <Plus size={16} />
                    Add Member
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map(member => (
                    <MemberCard
                        key={member.id}
                        member={member}
                        updateMemberMutation={updateMemberMutation}
                        deleteMemberMutation={deleteMemberMutation}
                    />
                ))}
            </div>

            {members.length === 0 && (
                <div className="text-center py-8 text-text-muted text-sm italic bg-surface dark:bg-surface-dark rounded-lg border border-dashed border-border dark:border-border-dark">
                    No members found. Add a member to start tracking individual limits.
                </div>
            )}
        </section>
    );
}
