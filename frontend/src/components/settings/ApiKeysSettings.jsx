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
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-text-primary dark:text-text-primary-dark">API Keys</h3>
                    <p className="text-sm text-text-muted mt-1">
                        Create API keys for programmatic access. Keys are shown only once upon creation.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition"
                >
                    <Plus size={16} />
                    Create Key
                </button>
            </div>

            {/* Newly Created Key Alert */}
            {newKeyData && (
                <div className="bg-accent-success/10 dark:bg-accent-success/20 border border-accent-success/20 dark:border-accent-success/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Check size={18} className="text-accent-success" />
                        <span className="font-medium text-accent-success">API Key Created</span>
                    </div>
                    <p className="text-sm text-accent-success/80 mb-3">
                        Copy this key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-card dark:bg-card-dark px-3 py-2 rounded-lg font-mono text-sm text-text-primary dark:text-text-primary-dark truncate border border-accent-success/20 dark:border-border-dark">
                            {newKeyData.key}
                        </code>
                        <button
                            onClick={handleCopyKey}
                            className="flex items-center gap-1 px-3 py-2 bg-accent-success hover:bg-accent-success/90 text-white text-sm font-medium rounded-lg transition"
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button
                        onClick={() => setNewKeyData(null)}
                        className="mt-3 text-sm text-accent-success hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* API Keys List */}
            <div className="bg-card dark:bg-card-dark rounded-xl border border-border dark:border-border-dark overflow-hidden">
                {apiKeys.length === 0 ? (
                    <div className="p-8 text-center text-text-muted">
                        <Key size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No API keys yet</p>
                        <p className="text-sm">Create a key to get started with the API</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border dark:divide-border-dark">
                        {apiKeys.map((key) => (
                            <div key={key.id} className="p-4 flex items-center justify-between hover:bg-surface dark:hover:bg-surface-dark transition group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <Key size={16} className="text-primary" />
                                        <span className="font-medium text-text-primary dark:text-text-primary-dark">{key.name}</span>
                                        <code className="text-xs bg-surface dark:bg-surface-dark px-2 py-0.5 rounded font-mono text-text-muted">
                                            {key.key_prefix}...
                                        </code>
                                        {!key.is_active && (
                                            <span className="text-xs bg-accent-error/10 text-accent-error px-2 py-0.5 rounded">
                                                Disabled
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
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
                                    className="text-text-muted hover:text-accent-error opacity-0 group-hover:opacity-100 transition p-2"
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
                    <div className="bg-card dark:bg-card-dark rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-4">Create API Key</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                    Name
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="e.g., Zapier Integration"
                                    className="w-full px-3 py-2 border border-input dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                    Scopes
                                </label>
                                <select
                                    name="scopes"
                                    className="w-full px-3 py-2 border border-input dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="read">Read Only</option>
                                    <option value="read,write">Read & Write</option>
                                    <option value="read,transactions">Read + Transactions</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                    Expires In (days)
                                </label>
                                <input
                                    name="expires"
                                    type="number"
                                    placeholder="Leave empty for no expiry"
                                    className="w-full px-3 py-2 border border-input dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-text-muted hover:bg-surface dark:hover:bg-surface-dark rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition disabled:opacity-50"
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
