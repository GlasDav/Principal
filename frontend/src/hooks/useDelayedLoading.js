import { useState, useEffect } from 'react';

/**
 * Custom hook to delay showing loading state for fast requests.
 * Prevents loading spinners from flashing briefly for requests that complete quickly.
 * 
 * @param {boolean} isLoading - The actual loading state from react-query or other source
 * @param {number} delay - Delay in milliseconds before showing loading state (default: 200ms)
 * @returns {boolean} - Whether to show the loading state
 * 
 * @example
 * const { isLoading } = useQuery(['data'], fetchData);
 * const showSpinner = useDelayedLoading(isLoading, 200);
 * 
 * if (showSpinner) return <Spinner />;
 */
export function useDelayedLoading(isLoading, delay = 200) {
    const [showLoading, setShowLoading] = useState(false);

    useEffect(() => {
        if (isLoading) {
            // Start a timer - only show loading state if still loading after delay
            const timeout = setTimeout(() => setShowLoading(true), delay);
            return () => clearTimeout(timeout);
        } else {
            // Immediately hide loading state when done
            setShowLoading(false);
        }
    }, [isLoading, delay]);

    return showLoading;
}

export default useDelayedLoading;
