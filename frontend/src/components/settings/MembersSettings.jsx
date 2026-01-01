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
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 hover:shadow-md transition-shadow">
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
                            className="font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition px-1 flex-1"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Theme</span>
                    <ColorPicker
                        currentColor={member.color}
                        onChange={(color) => updateMemberMutation.mutate({ id: member.id, data: { ...member, color } })}
                    />
                </div>

                <button
                    onClick={() => {
                        if (confirm("Delete this member? Limits associated with them will be removed.")) deleteMemberMutation.mutate(member.id);
                    }}
                    className="text-slate-300 hover:text-red-400 transition self-start"
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
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Users size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Household Members</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage people in your household for budgeting</p>
                    </div>
                </div>
                <button
                    onClick={() => createMemberMutation.mutate({ name: "New Member", color: "#6366f1", avatar: "User" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
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
                <div className="text-center py-8 text-slate-400 text-sm italic bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    No members found. Add a member to start tracking individual limits.
                </div>
            )}
        </section>
    );
}
