import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-8"
                >
                    <ArrowLeft size={20} />
                    Back
                </button>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText className="text-indigo-600" size={32} />
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Terms of Service</h1>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Last updated: {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <div className="prose dark:prose-invert max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">1. Acceptance of Terms</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                By accessing or using DollarData ("the Service"), you agree to be bound by these
                                Terms of Service. If you do not agree to these terms, please do not use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">2. Description of Service</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                DollarData is a personal finance management application that helps you track
                                transactions, manage budgets, monitor net worth, and achieve financial goals. The
                                Service is provided for personal, non-commercial use.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">3. Account Responsibilities</h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-3">You are responsible for:</p>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
                                <li>Maintaining the confidentiality of your account credentials</li>
                                <li>All activities that occur under your account</li>
                                <li>Providing accurate and complete information</li>
                                <li>Keeping your account information up to date</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">4. Acceptable Use</h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-3">You agree not to:</p>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
                                <li>Use the Service for any illegal purpose</li>
                                <li>Attempt to gain unauthorized access to the Service</li>
                                <li>Interfere with or disrupt the Service</li>
                                <li>Upload malicious content or code</li>
                                <li>Share your account with others</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">5. Financial Disclaimer</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                The Service provides tools and information for personal finance management. It does
                                not constitute financial, investment, tax, or legal advice. You should consult with
                                qualified professionals before making financial decisions. We are not responsible for
                                any financial decisions you make based on information from the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">6. Data Accuracy</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                While we strive to provide accurate transaction categorization and financial calculations,
                                we cannot guarantee the accuracy of all data. You should verify important financial
                                information independently.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">7. Intellectual Property</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                The Service and its original content, features, and functionality are owned by
                                DollarData and are protected by international copyright, trademark, and other
                                intellectual property laws.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">8. Limitation of Liability</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                To the maximum extent permitted by law, DollarData shall not be liable for any
                                indirect, incidental, special, consequential, or punitive damages resulting from your
                                use of the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">9. Termination</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                We may terminate or suspend your account at any time for violations of these Terms.
                                You may also delete your account at any time through the Settings page.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">10. Changes to Terms</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                We reserve the right to modify these Terms at any time. We will notify you of significant
                                changes by email or through the Service. Your continued use of the Service after changes
                                constitutes acceptance of the new Terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">11. Contact</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                For questions about these Terms, please contact us at legal@dollardata.app.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
