/**
 * Test Utilities
 * Custom render function with providers for testing components
 */
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';

// Create a test query client with default options
function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false, // Disable retries in tests
                cacheTime: 0, // Disable caching in tests
            },
            mutations: {
                retry: false,
            },
        },
    });
}

/**
 * Custom render function that wraps components with necessary providers
 * @param {React.Element} ui - Component to render
 * @param {Object} options - Render options
 * @param {Object} options.queryClient - Custom QueryClient instance
 * @param {Object} options.initialRoute - Initial router location
 * @param {Object} options.authValue - Mock auth context value
 * @returns {Object} - Render result from @testing-library/react
 */
export function renderWithProviders(
    ui,
    {
        queryClient = createTestQueryClient(),
        initialRoute = '/',
        authValue = { user: null, login: vi.fn(), logout: vi.fn(), isLoading: false },
        ...renderOptions
    } = {}
) {
    function Wrapper({ children }) {
        // Set initial route if specified
        if (initialRoute !== '/') {
            window.history.pushState({}, 'Test page', initialRoute);
        }

        return (
            <QueryClientProvider client={queryClient}>
                <AuthProvider value={authValue}>
                    <BrowserRouter>
                        {children}
                    </BrowserRouter>
                </AuthProvider>
            </QueryClientProvider>
        );
    }

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a mock authenticated user session
 */
export function createMockAuthContext(overrides = {}) {
    return {
        user: {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            currency_symbol: 'AUD',
            ...overrides.user,
        },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        ...overrides,
    };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
