import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
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
                        <Shield className="text-indigo-600" size={32} />
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Last updated: {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <div className="prose dark:prose-invert max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">1. Introduction</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                DollarData ("we", "our", or "us") is committed to protecting your personal information
                                and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and
                                safeguard your information when you use our personal finance management application.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">2. Information We Collect</h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-3">We collect information that you provide directly to us, including:</p>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
                                <li><strong>Account Information:</strong> Email address and password when you register</li>
                                <li><strong>Financial Data:</strong> Transaction data, account balances, and financial goals you enter or import</li>
                                <li><strong>Profile Information:</strong> Names and preferences you set in your account</li>
                                <li><strong>Usage Data:</strong> How you interact with our application</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">3. How We Use Your Information</h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-3">We use your information to:</p>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
                                <li>Provide, maintain, and improve our services</li>
                                <li>Process and categorize your financial transactions</li>
                                <li>Generate insights and analytics about your finances</li>
                                <li>Communicate with you about your account</li>
                                <li>Ensure the security of your account</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">4. Data Security</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                We implement appropriate technical and organizational security measures to protect your
                                personal information. This includes encryption of data in transit and at rest, secure
                                password hashing using industry-standard algorithms, and regular security assessments.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">5. Data Sharing</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                We do not sell, trade, or rent your personal information to third parties. We may share
                                your data only with service providers who assist us in operating our application, and
                                only to the extent necessary for them to perform their services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">6. Your Rights</h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-3">You have the right to:</p>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2">
                                <li>Access the personal information we hold about you</li>
                                <li>Request correction of inaccurate information</li>
                                <li>Request deletion of your account and data</li>
                                <li>Export your data in a portable format</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">7. Contact Us</h2>
                            <p className="text-slate-600 dark:text-slate-300">
                                If you have any questions about this Privacy Policy or our data practices, please
                                contact us at privacy@dollardata.app.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
