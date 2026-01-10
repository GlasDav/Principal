import React, { useRef, useState } from 'react';
import { toLocalISOString } from '../../utils/dateUtils';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import * as api from '../../services/api';

export default function DataSettings() {
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [importStatus, setImportStatus] = useState(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImportStatus("Importing...");
        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.importTransactions(formData);
            setImportStatus("Import successful!");
            queryClient.invalidateQueries(['transactions']);
            setTimeout(() => setImportStatus(null), 3000);
        } catch (error) {
            console.error(error);
            setImportStatus(`Error: ${error.message}`);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await api.exportData();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `principal_export_${toLocalISOString(new Date())}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed");
        }
    };

    return (
        <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark rounded-lg">
                    <Save size={20} />
                </div>
                <div>
                    <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Data Management</h2>
                    <p className="text-sm text-text-muted">Import, export, or delete your data</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* JSON Export/Import */}
                <div className="p-4 bg-surface dark:bg-surface-dark rounded-lg space-y-4">
                    <h3 className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Backup & Restore</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        <button
                            onClick={handleExport}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/30 transition group"
                        >
                            <Download size={18} className="text-text-muted group-hover:text-primary transition" />
                            <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Export JSON Backup</span>
                        </button>

                        <div className="flex-1 relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl hover:bg-accent-success/10 dark:hover:bg-accent-success/20 hover:border-accent-success/30 transition group"
                            >
                                <Upload size={18} className="text-text-muted group-hover:text-accent-success transition" />
                                <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                                    {importStatus || "Restore from JSON"}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* CSV/PDF Link */}
                <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-lg border border-primary/20 dark:border-primary/30 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-primary dark:text-primary-light">Advanced Import/Export</h3>
                        <p className="text-xs text-primary/80 dark:text-primary-light/80 mt-1">
                            Import bank statements (PDF/CSV) or export transaction history.
                        </p>
                    </div>
                    <a
                        href="/data-management"
                        className="px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-hover transition"
                    >
                        Go to Data Management
                    </a>
                </div>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-border dark:border-border-dark">
                    <h3 className="text-sm font-bold text-accent-error mb-4 flex items-center gap-2">
                        <ShieldAlert size={16} /> Danger Zone
                    </h3>

                    <button className="w-full md:w-auto px-4 py-2 border border-accent-error/30 text-accent-error rounded-lg text-sm font-medium hover:bg-accent-error/10 hover:border-accent-error transition flex items-center gap-2">
                        <Trash2 size={16} />
                        Delete All Transactions (Coming Soon)
                    </button>
                </div>
            </div>
        </section>
    );
}
