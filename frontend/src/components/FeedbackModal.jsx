/**
 * Feedback Modal Component
 * 
 * In-app feedback and bug reporting mechanism.
 * Allows users to submit feedback, report bugs, or request features.
 */
import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    ChatBubbleLeftRightIcon,
    BugAntIcon,
    LightBulbIcon,
    XMarkIcon,
    PaperAirplaneIcon
} from '@heroicons/react/24/outline';

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Report a Bug', icon: BugAntIcon, color: 'var(--color-accent-error)' },
    { id: 'feature', label: 'Request Feature', icon: LightBulbIcon, color: 'var(--color-accent-warning)' },
    { id: 'feedback', label: 'General Feedback', icon: ChatBubbleLeftRightIcon, color: 'var(--color-primary)' },
];

export function FeedbackModal({ isOpen, onClose }) {
    const [feedbackType, setFeedbackType] = useState('feedback');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);

        // Simulate API call - in production, this would POST to your feedback endpoint
        // For now, we'll store locally and/or log to console
        const feedbackData = {
            type: feedbackType,
            message: message.trim(),
            email: email.trim() || null,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
        };

        // Store in localStorage for later retrieval (backup before proper backend)
        try {
            const existing = JSON.parse(localStorage.getItem('principal_feedback') || '[]');
            existing.push(feedbackData);
            localStorage.setItem('principal_feedback', JSON.stringify(existing));
        } catch (err) {
            console.error('Failed to store feedback:', err);
        }

        // TODO: Replace with actual API call
        // await api.post('/feedback', feedbackData);

        setTimeout(() => {
            setIsSubmitting(false);
            setIsSubmitted(true);
        }, 1000);
    };

    const handleClose = () => {
        onClose();
        // Reset after animation
        setTimeout(() => {
            setFeedbackType('feedback');
            setMessage('');
            setEmail('');
            setIsSubmitted(false);
        }, 300);
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-card dark:bg-card-dark p-6 shadow-xl transition-all border border-border dark:border-border-dark">
                                <div className="flex justify-between items-center mb-4">
                                    <Dialog.Title className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                                        {isSubmitted ? 'Thank You!' : 'Send Feedback'}
                                    </Dialog.Title>
                                    <button
                                        onClick={handleClose}
                                        className="text-text-muted hover:text-text-primary dark:hover:text-text-primary-dark transition-colors"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                {isSubmitted ? (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 bg-accent-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-accent-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                                            Your feedback has been received. We appreciate you taking the time to help improve DollarData!
                                        </p>
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        {/* Feedback Type Selection */}
                                        <div className="flex gap-2 mb-4">
                                            {FEEDBACK_TYPES.map((type) => {
                                                const Icon = type.icon;
                                                const isSelected = feedbackType === type.id;
                                                return (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => setFeedbackType(type.id)}
                                                        className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${isSelected
                                                            ? 'border-primary bg-primary/10 dark:bg-primary/20'
                                                            : 'border-border dark:border-border-dark hover:border-text-muted dark:hover:border-text-muted-dark bg-surface dark:bg-surface-dark'
                                                            }`}
                                                    >
                                                        <Icon
                                                            className="h-5 w-5"
                                                            style={{ color: isSelected ? type.color : 'var(--color-text-muted)' }}
                                                        />
                                                        <span className={`text-xs ${isSelected ? 'text-text-primary dark:text-text-primary-dark font-medium' : 'text-text-muted'}`}>
                                                            {type.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Message Input */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                                {feedbackType === 'bug' ? 'Describe the issue' :
                                                    feedbackType === 'feature' ? 'Describe your idea' :
                                                        'Your feedback'}
                                            </label>
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder={
                                                    feedbackType === 'bug'
                                                        ? "What happened? What did you expect to happen?"
                                                        : feedbackType === 'feature'
                                                            ? "What feature would you like to see?"
                                                            : "Share your thoughts..."
                                                }
                                                rows={4}
                                                className="w-full px-3 py-2 border border-input dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary resize-none placeholder-text-muted/50"
                                                required
                                            />
                                        </div>

                                        {/* Email (Optional) */}
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-text-secondary dark:text-text-secondary-dark mb-1">
                                                Email <span className="text-text-muted">(optional)</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="your@email.com"
                                                className="w-full px-3 py-2 border border-input dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary placeholder-text-muted/50"
                                            />
                                            <p className="text-xs text-text-muted mt-1">
                                                Include if you'd like us to follow up
                                            </p>
                                        </div>

                                        {/* Submit Button */}
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !message.trim()}
                                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${isSubmitting || !message.trim()
                                                ? 'bg-surface dark:bg-surface-dark text-text-muted cursor-not-allowed'
                                                : 'bg-primary text-white hover:bg-primary-hover'
                                                }`}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <PaperAirplaneIcon className="h-4 w-4" />
                                                    Send Feedback
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

/**
 * Floating feedback button
 */
export function FeedbackButton({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-hover hover:scale-110 transition-all flex items-center justify-center z-40"
            title="Send Feedback"
        >
            <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>
    );
}

export default FeedbackModal;
