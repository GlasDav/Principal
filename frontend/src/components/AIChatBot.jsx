import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User, Lightbulb, Loader2 } from 'lucide-react';
import { chatWithAI } from '../services/api';

// Simple markdown-like formatter for chat messages
function formatMessage(text) {
    if (!text) return text;

    // Split by newlines first to preserve structure
    const lines = text.split('\n');

    // Check if we have bullet points - group them into lists
    const elements = [];
    let currentList = [];

    lines.forEach((line, lineIdx) => {
        const trimmedLine = line.trim();
        const isBullet = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ');

        if (isBullet) {
            // Add to current list
            const bulletContent = trimmedLine.slice(2); // Remove "* " or "- "
            currentList.push(formatLine(bulletContent, lineIdx));
        } else {
            // Flush current list if any
            if (currentList.length > 0) {
                elements.push(
                    <ul key={`list-${lineIdx}`} className="ml-3 my-1.5 space-y-1">
                        {currentList.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 text-xs">●</span>
                                <span className="flex-1">{item}</span>
                            </li>
                        ))}
                    </ul>
                );
                currentList = [];
            }
            // Add regular line
            if (trimmedLine) {
                elements.push(
                    <p key={lineIdx} className="my-1">
                        {formatLine(line, lineIdx)}
                    </p>
                );
            } else if (lineIdx < lines.length - 1 && elements.length > 0) {
                // Add spacing for empty lines
            }
        }
    });

    // Flush remaining list
    if (currentList.length > 0) {
        elements.push(
            <ul key="list-final" className="ml-3 my-1.5 space-y-1">
                {currentList.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 text-xs">●</span>
                        <span className="flex-1">{item}</span>
                    </li>
                ))}
            </ul>
        );
    }

    return elements.length > 0 ? elements : text;
}

// Format a single line (handle bold, etc)
function formatLine(line, lineIdx) {
    const parts = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            parts.push(line.slice(lastIndex, match.index));
        }
        parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
    }

    return parts.length > 0 ? parts : line;
}


export default function AIChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hi! I'm your AI financial assistant. Ask me anything about your spending, budgets, or finances.",
            suggestions: [
                "How much did I spend last month?",
                "What are my biggest expenses?",
                "Am I on track with my budget?"
            ]
        }
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const chatMutation = useMutation({
        mutationFn: chatWithAI,
        onSuccess: (data) => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.answer,
                suggestions: data.suggestions || [],
                dataPoints: data.data_points || []
            }]);
        },
        onError: (error) => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again.",
                suggestions: []
            }]);
        }
    });

    // Context Awareness
    const location = useLocation();
    const [contextSuggestions, setContextSuggestions] = useState([]);

    const SUGGESTED_PROMPTS = {
        '/': ["How am I doing this month?", "What's my net worth trend?", "Any upcoming bills?"],
        '/transactions': ["Show my largest expenses", "Find duplicate transactions", "Analyze my dining spending"],
        '/net-worth': ["Update property value", "Add a new asset", "Graph my liquid assets"],
        '/budget': ["Am I over budget?", "Which category has the most spend?", "Create a saving rule"]
    };

    useEffect(() => {
        const path = location.pathname;
        // Match exact path or sub-paths if needed
        const suggestions = SUGGESTED_PROMPTS[path] || SUGGESTED_PROMPTS['/'] || [];
        setContextSuggestions(suggestions);
    }, [location.pathname]);

    const handleSend = (question) => {
        const q = question || input;
        if (!q.trim()) return;

        setMessages(prev => [...prev, { role: 'user', content: q }]);
        setInput('');
        chatMutation.mutate(q);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 ${isOpen
                    ? 'bg-button-dark hover:bg-button-dark-hover'
                    : 'bg-primary hover:bg-primary-hover animate-pulse hover:animate-none'
                    }`}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <MessageCircle className="w-6 h-6 text-white" />
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[600px] bg-card dark:bg-card-dark rounded-2xl shadow-2xl border border-border dark:border-border-dark flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-primary text-white flex items-center gap-3">
                        <div className="p-2 bg-primary-hover rounded-full">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold">AI Assistant</h3>
                            <p className="text-xs text-primary-light/80">Ask me about your finances</p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-2xl rounded-br-md'
                                    : 'bg-surface dark:bg-card-dark text-text-primary dark:text-text-primary-dark rounded-2xl rounded-bl-md'
                                    } p-3`}>
                                    {/* Message Content */}
                                    <div className="text-sm">{formatMessage(msg.content)}</div>

                                    {/* Data Points */}
                                    {msg.dataPoints && msg.dataPoints.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-1">
                                            {msg.dataPoints.map((dp, i) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <span className="text-slate-500 dark:text-slate-400">{dp.label}</span>
                                                    <span className="font-medium">{dp.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Suggestions */}
                                    {msg.suggestions && msg.suggestions.length > 0 && msg.role === 'assistant' && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                                                <Lightbulb className="w-3 h-3" /> Try asking:
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {msg.suggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSend(s)}
                                                        className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800/40 transition-colors"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {chatMutation.isPending && (
                            <div className="flex justify-start">
                                <div className="bg-surface dark:bg-card-dark rounded-2xl rounded-bl-md p-3">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t border-border dark:border-border-dark bg-surface/50 dark:bg-card-dark/50">
                        {/* Context Suggestions Chips */}
                        {contextSuggestions.length > 0 && (
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                                {contextSuggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(s)}
                                        className="whitespace-nowrap px-3 py-1 bg-card dark:bg-card-dark border border-primary/20 dark:border-border-dark text-primary dark:text-primary-light text-xs rounded-full shadow-sm hover:bg-primary/10 dark:hover:bg-card-dark transition-colors"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask about your finances..."
                                className="flex-1 px-4 py-2 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:text-text-primary-dark"
                                disabled={chatMutation.isPending}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || chatMutation.isPending}
                                className="p-2 bg-primary text-white rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
