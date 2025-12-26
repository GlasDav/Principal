import { useEffect, useRef } from 'react';

/**
 * Accessibility utilities and hooks
 */

/**
 * useFocusTrap - Traps focus within a container (for modals, dialogs)
 */
export function useFocusTrap(isActive = true) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        firstElement?.focus();

        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    return containerRef;
}

/**
 * useAnnounce - Announces messages to screen readers
 */
export function useAnnounce() {
    const announce = (message, priority = 'polite') => {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);

        setTimeout(() => announcement.remove(), 1000);
    };

    return announce;
}

/**
 * VisuallyHidden - Hides content visually but keeps it accessible
 */
export function VisuallyHidden({ children, as: Component = 'span' }) {
    return (
        <Component
            style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
            }}
        >
            {children}
        </Component>
    );
}

/**
 * skipLink - Creates a skip-to-main-content link
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }) {
    return (
        <a
            href={href}
            className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:left-4 focus:top-4"
        >
            {children}
        </a>
    );
}

/**
 * Keyboard navigation helper
 */
export function useKeyboardNavigation(items, onSelect, isEnabled = true) {
    const selectedIndex = useRef(0);

    useEffect(() => {
        if (!isEnabled) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex.current = Math.min(selectedIndex.current + 1, items.length - 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex.current = Math.max(selectedIndex.current - 1, 0);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(items[selectedIndex.current], selectedIndex.current);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [items, onSelect, isEnabled]);

    return selectedIndex;
}

export default {
    useFocusTrap,
    useAnnounce,
    VisuallyHidden,
    SkipLink,
    useKeyboardNavigation
};
