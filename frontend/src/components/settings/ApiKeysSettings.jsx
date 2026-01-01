import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const API_URL = API_BASE_URL;

// API calls
const getApiKeys = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/api-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch API keys');
    return response.json();
};

const createApiKey = async (data) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/api-keys`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create API key');
    return response.json();
};

const deleteApiKey = async (keyId) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete API key');
    return response.json();
};

export default function ApiKeysSettings() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyData, setNewKeyData] = useState(null);
    const [copied, setCopied] = useState(false);

    const { data: apiKeys = [], isLoading } = useQuery({
        queryKey: ['apiKeys'],
        queryFn: getApiKeys
    });

    const createMutation = useMutation({
        mutationFn: createApiKey,
        onSuccess: (data) => {
            setNewKeyData(data);
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteApiKey,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
        }
    });

    const handleCreate = (e) => {
        e.preventDefault();
        const form = e.target;
        createMutation.mutate({
            name: form.name.value,
            scopes: form.scopes.value,
            expires_in_days: form.expires.value ? parseInt(form.expires.value) : null
        });
        setShowCreateModal(false);
    };

    const handleCopyKey = async () => {
        if (newKeyData?.key) {
            await navigator.clipboard.writeText(newKeyData.key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleDateString();
    };

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white">API Keys</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Create API keys for programmatic access. Keys are shown only once upon creation.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
                >
                    <Plus size={16} />
                    Create Key
                </button>
            </div>

            {/* Newly Created Key Alert */}
            {newKeyData && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Check size={18} className="text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-800 dark:text-green-300">API Key Created</span>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                        Copy this key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg font-mono text-sm text-slate-800 dark:text-slate-200 truncate border border-green-200 dark:border-slate-600">
                            {newKeyData.key}
                        </code>
                        <button
                            onClick={handleCopyKey}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button
                        onClick={() => setNewKeyData(null)}
                        className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* API Keys List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {apiKeys.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        <Key size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No API keys yet</p>
                        <p className="text-sm">Create a key to get started with the API</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {apiKeys.map((key) => (
                            <div key={key.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <Key size={16} className="text-indigo-500" />
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{key.name}</span>
                                        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-slate-500 dark:text-slate-400">
                                            {key.key_prefix}...
                                        </code>
                                        {!key.is_active && (
                                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
                                                Disabled
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Scopes: {key.scopes}</span>
                                        <span>Created: {formatDate(key.created_at)}</span>
                                        <span>Expires: {key.expires_at ? formatDate(key.expires_at) : 'Never'}</span>
                                        {key.last_used_at && <span>Last used: {formatDate(key.last_used_at)}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) {
                                            deleteMutation.mutate(key.id);
                                        }
                                    }}
                                    disabled={deleteMutation.isPending}
                                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-2"
                                    title="Revoke key"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Create API Key</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Name
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="e.g., Zapier Integration"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Scopes
                                </label>
                                <select
                                    name="scopes"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="read">Read Only</option>
                                    <option value="read,write">Read & Write</option>
                                    <option value="read,transactions">Read + Transactions</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Expires In (days)
                                </label>
                                <input
                                    name="expires"
                                    type="number"
                                    placeholder="Leave empty for no expiry"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                                >
                                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
