import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

/**
 * Modal for importing net worth history from a CSV file.
 * Handles file selection, upload, and displays results/errors.
 */
export default function ImportNetWorthModal({ isOpen, onClose }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);
    const queryClient = useQueryClient();

    const importMutation = useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/net-worth/import-history', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: (data) => {
            setResult(data);
            // Invalidate queries to refresh Net Worth data
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['netWorthHistory'] });
        },
        onError: (error) => {
            setResult({
                imported_snapshots: 0,
                created_accounts: 0,
                updated_accounts: 0,
                errors: [error.response?.data?.detail || 'Import failed. Please check your file format.']
            });
        }
    });

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setResult(null);
        }
    };

    const handleImport = () => {
        if (selectedFile) {
            importMutation.mutate(selectedFile);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setResult(null);
        importMutation.reset();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-text-primary">Import Net Worth History</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Instructions */}
                    <div className="text-sm text-text-secondary space-y-2">
                        <p>Upload a CSV file with your net worth history. Required columns:</p>
                        <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                            <li><code className="bg-surface px-1 rounded">date</code> - Format: YYYY-MM-DD</li>
                            <li><code className="bg-surface px-1 rounded">account_name</code> - e.g., "Savings Account"</li>
                            <li><code className="bg-surface px-1 rounded">account_type</code> - "Asset" or "Liability"</li>
                            <li><code className="bg-surface px-1 rounded">account_category</code> - e.g., "Cash", "Investment"</li>
                            <li><code className="bg-surface px-1 rounded">balance</code> - Numeric value</li>
                        </ul>
                    </div>

                    {/* File Input */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-2 text-text-primary">
                                <FileText className="w-5 h-5 text-primary" />
                                <span className="font-medium">{selectedFile.name}</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="w-8 h-8 mx-auto text-text-secondary" />
                                <p className="text-text-secondary">
                                    Click to select a CSV file
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    {result && (
                        <div className={`rounded-lg p-4 ${result.errors?.length > 0 && result.imported_snapshots === 0 ? 'bg-accent-error/10' : 'bg-accent-success/10'}`}>
                            {result.imported_snapshots > 0 || result.created_accounts > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-accent-success font-medium">
                                        <CheckCircle2 className="w-5 h-5" />
                                        Import Complete
                                    </div>
                                    <ul className="text-sm text-text-secondary space-y-1">
                                        {result.imported_snapshots > 0 && (
                                            <li>✓ {result.imported_snapshots} snapshot{result.imported_snapshots !== 1 ? 's' : ''} imported</li>
                                        )}
                                        {result.created_accounts > 0 && (
                                            <li>✓ {result.created_accounts} new account{result.created_accounts !== 1 ? 's' : ''} created</li>
                                        )}
                                        {result.updated_accounts > 0 && (
                                            <li>✓ {result.updated_accounts} account{result.updated_accounts !== 1 ? 's' : ''} updated</li>
                                        )}
                                    </ul>
                                </div>
                            ) : null}

                            {result.errors?.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    <div className="flex items-center gap-2 text-accent-error font-medium">
                                        <AlertCircle className="w-5 h-5" />
                                        {result.imported_snapshots > 0 ? 'Some rows had errors:' : 'Import Failed'}
                                    </div>
                                    <ul className="text-sm text-text-secondary space-y-1 max-h-32 overflow-y-auto">
                                        {result.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t border-border">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button
                            onClick={handleImport}
                            disabled={!selectedFile || importMutation.isPending}
                            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {importMutation.isPending ? 'Importing...' : 'Import'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
