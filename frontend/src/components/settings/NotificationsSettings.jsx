import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@headlessui/react';
import { Bell } from 'lucide-react';
import * as api from '../../services/api';

export default function NotificationsSettings() {
    const queryClient = useQueryClient();
    const { data: notificationSettings, isLoading } = useQuery({
        queryKey: ['notificationSettings'],
        queryFn: api.getNotificationSettings
    });

    const updateNotificationSettingsMutation = useMutation({
        mutationFn: api.updateNotificationSettings,
        onSuccess: () => {
            queryClient.invalidateQueries(['notificationSettings']);
        },
    });

    if (isLoading) return <div className="p-4">Loading notification settings...</div>;

    return (
        <section className="bg-card dark:bg-card-dark rounded-xl p-6 shadow-sm border border-border dark:border-border-dark">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent-warning/10 text-accent-warning rounded-lg">
                    <Bell size={20} />
                </div>
                <div>
                    <h2 className="font-semibold text-text-primary dark:text-text-primary-dark">Notifications</h2>
                    <p className="text-sm text-text-muted">Configure which alerts you receive</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Budget Alerts */}
                {/* Budget Alerts */}
                <div className="flex items-center justify-between p-4 bg-surface dark:bg-surface-dark rounded-lg">
                    <div>
                        <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Budget Exceeded Alerts</span>
                        <p className="text-xs text-text-muted">Notify when spending exceeds 80%, 100%, 120% of budget</p>
                    </div>
                    <Switch
                        checked={notificationSettings?.budget_alerts ?? true}
                        onChange={(checked) => updateNotificationSettingsMutation.mutate({
                            ...notificationSettings,
                            budget_alerts: checked
                        })}
                        className={`${notificationSettings?.budget_alerts ? 'bg-primary' : 'bg-input'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                        <span className={`${notificationSettings?.budget_alerts ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                </div>

                {/* Bill Reminders */}
                {/* Bill Reminders */}
                <div className="flex items-center justify-between p-4 bg-surface dark:bg-surface-dark rounded-lg">
                    <div>
                        <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Bill Reminders</span>
                        <p className="text-xs text-text-muted">Remind me about upcoming bills</p>
                    </div>
                    <Switch
                        checked={notificationSettings?.bill_reminders ?? true}
                        onChange={(checked) => updateNotificationSettingsMutation.mutate({
                            ...notificationSettings,
                            bill_reminders: checked
                        })}
                        className={`${notificationSettings?.bill_reminders ? 'bg-primary' : 'bg-input'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                        <span className={`${notificationSettings?.bill_reminders ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                </div>

                {/* Days before bill reminder */}
                {/* Days before bill reminder */}
                {notificationSettings?.bill_reminders && (
                    <div className="flex items-center justify-between p-4 bg-surface dark:bg-surface-dark rounded-lg ml-4">
                        <span className="text-sm text-text-secondary dark:text-text-secondary-dark">Remind me this many days before</span>
                        <select
                            value={notificationSettings?.bill_reminder_days ?? 3}
                            onChange={(e) => updateNotificationSettingsMutation.mutate({
                                ...notificationSettings,
                                bill_reminder_days: parseInt(e.target.value)
                            })}
                            className="px-3 py-1 bg-card dark:bg-card-dark border border-input dark:border-input-dark rounded-lg text-sm outline-none cursor-pointer"
                        >
                            {[1, 2, 3, 5, 7].map(d => (
                                <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Goal Milestones */}
                {/* Goal Milestones */}
                <div className="flex items-center justify-between p-4 bg-surface dark:bg-surface-dark rounded-lg">
                    <div>
                        <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Goal Milestone Celebrations</span>
                        <p className="text-xs text-text-muted">Celebrate when you reach 25%, 50%, 75%, 100% of goals</p>
                    </div>
                    <Switch
                        checked={notificationSettings?.goal_milestones ?? true}
                        onChange={(checked) => updateNotificationSettingsMutation.mutate({
                            ...notificationSettings,
                            goal_milestones: checked
                        })}
                        className={`${notificationSettings?.goal_milestones ? 'bg-primary' : 'bg-input'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                        <span className={`${notificationSettings?.goal_milestones ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                </div>
            </div>
        </section>
    );
}
