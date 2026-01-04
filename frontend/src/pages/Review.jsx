import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBuckets, getSettings, getMembers } from '../services/api';
import { CheckCircle, XCircle, Clock, Users, ArrowRight } from 'lucide-react';
import { sortBucketsByGroup } from '../utils/bucketUtils';

export default function Review() {
    const queryClient = useQueryClient();

    // Fetch user settings
    const { data: userSettings, isLoading: loadingSettings } = useQuery({
        queryKey: ['userSettings'],
        queryFn: getSettings
    });

    // Fetch buckets for category display
    const { data: buckets = [] } = useQuery({
        queryKey: ['buckets'],
        queryFn: getBuckets
    });

    // Fetch pending review transactions
    const { data: reviewData, isLoading: loadingReview } = useQuery({
        queryKey: ['pendingReview'],
        queryFn: async () => {
            const res = await api.get('/transactions/pending-review');
            return res.data;
        }
    });

    // Fetch Household Members
    const { data: members = [], isLoading: loadingMembers } = useQuery({
        queryKey: ['members'],
        queryFn: getMembers
    });

    // Update transaction mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            await api.put(`/transactions/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingReview'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
    });

    const transactions = reviewData?.items || [];

    // Group transactions by assigned_to field (matches member.name)
    const getTransactionsForMember = (memberId, memberIndex) => {
        const member = members.find(m => m.id === memberId);
        const memberName = member ? member.name : '';

        return transactions.filter(t => {
            // Match exactly by name (current behavior of Transactions.jsx)
            if (t.assigned_to === memberName) return true;
            // Fallback: match by ID string
            if (t.assigned_to === String(memberId)) return true;
            // Legacy: 'A' = first member, 'B' = second member
            if (memberIndex === 0 && t.assigned_to === 'A') return true;
            if (memberIndex === 1 && t.assigned_to === 'B') return true;
            return false;
        });
    };

    const handleApprove = (txnId) => {
        updateMutation.mutate({ id: txnId, data: { assigned_to: '', is_verified: true } });
    };

    const handleReassign = (txnId, newAssignee) => {
        updateMutation.mutate({ id: txnId, data: { assigned_to: newAssignee } });
    };

    if (loadingSettings || loadingReview || loadingMembers) {
        return <div className="p-8 dark:bg-slate-900 dark:text-white h-screen">Loading...</div>;
    }

    // Check if there are at least 2 members to enable review feature
    if (members.length < 2) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="max-w-4xl mx-auto p-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center">
                        <Users size={48} className="mx-auto text-slate-400 mb-4" />
                        <h2 className="text-xl font-bold text-slate-700 dark:text-white mb-2">Family Review</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Family review requires at least 2 household members.
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                            Add more members in Settings to use this feature.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const TransactionRow = ({ txn, currentMemberId }) => {
        const bucket = buckets.find(b => b.id === txn.bucket_id);
        return (
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 dark:text-white truncate">{txn.description}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(txn.date).toLocaleDateString('en-AU')}
                    </div>
                </div>
                <div className="mx-4">
                    <select
                        className="bg-slate-50 dark:bg-slate-700 border-0 rounded-md text-sm text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 py-1.5 pl-2 pr-8"
                        value={txn.bucket_id || ""}
                        onChange={(e) => updateMutation.mutate({
                            id: txn.id,
                            data: { bucket_id: e.target.value ? parseInt(e.target.value) : null }
                        })}
                    >
                        <option value="">Uncategorized</option>
                        {sortBucketsByGroup(buckets).map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className={`text-right font-semibold mr-4 w-24 ${txn.amount < 0 ? 'text-slate-800 dark:text-white' : 'text-green-600'}`}>
                    ${Math.abs(txn.amount).toFixed(2)}
                </div>
                <div className="flex gap-2">
                    {/* Reassign dropdown */}
                    <select
                        className="bg-slate-50 dark:bg-slate-700 border-0 rounded-md text-xs text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 focus:ring-2 focus:ring-indigo-500 py-1.5 pl-2 pr-6"
                        value=""
                        onChange={(e) => {
                            if (e.target.value) handleReassign(txn.id, e.target.value);
                        }}
                    >
                        <option value="">Reassign...</option>
                        {members.filter(m => String(m.id) !== String(currentMemberId)).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => handleApprove(txn.id)}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg text-sm font-medium transition"
                    >
                        <CheckCircle size={16} />
                        Approve
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-5xl mx-auto p-6 space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Family Review</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Review and approve transactions assigned to household members.
                    </p>
                </header>

                {/* Summary Cards - One for each member */}
                <div className={`grid grid-cols-1 ${members.length === 2 ? 'md:grid-cols-2' : members.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
                    {members.map((member, index) => {
                        const pendingCount = getTransactionsForMember(member.id, index).length;
                        return (
                            <div key={member.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: member.color + '20' }}>
                                        <Clock size={20} style={{ color: member.color }} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-800 dark:text-white">{pendingCount}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: member.color }}></span>
                                            Pending for {member.name}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Transaction queues for each member */}
                {members.map((member, index) => {
                    const pending = getTransactionsForMember(member.id, index);
                    if (pending.length === 0) return null;

                    return (
                        <section key={member.id}>
                            <h2 className="text-lg font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }}></span>
                                For {member.name} to Review
                            </h2>
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {pending.map(txn => (
                                    <TransactionRow key={txn.id} txn={txn} currentMemberId={member.id} />
                                ))}
                            </div>
                        </section>
                    );
                })}

                {/* Empty State */}
                {transactions.length === 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-700">
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-2">All caught up!</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            No transactions need review right now.
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                            To assign a transaction for review, select "Assign to Member" in the Transactions page.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
