import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Check } from 'lucide-react';
import * as api from '../../services/api';

// Preset color palette
const COLOR_PALETTE = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ef4444', // Red
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#a855f7', // Violet
];

const ColorPicker = ({ currentColor, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            {/* Current Color Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 rounded-full shadow-sm border-2 border-white dark:border-slate-600 hover:scale-105 transition-transform cursor-pointer"
                style={{ backgroundColor: currentColor || '#6366f1' }}
                title="Change member color"
            />

            {/* Color Palette Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Color Grid */}
                    <div className="absolute right-0 mt-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 grid grid-cols-4 gap-2">
                        {COLOR_PALETTE.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    onChange(color);
                                    setIsOpen(false);
                                }}
                                className="w-8 h-8 rounded-full hover:scale-110 transition-transform relative group"
                                style={{ backgroundColor: color }}
                                title={color}
                            >
                                {currentColor === color && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Check size={16} className="text-white drop-shadow-lg" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
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
