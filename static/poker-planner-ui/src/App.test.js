import { render, screen } from '@testing-library/react';
import App from './App';
import { view } from '@forge/bridge';

// Mock @forge/bridge invoke and view
jest.mock('@forge/bridge', () => ({
  __esModule: true,
  invoke: jest.fn(),
  view: {
    theme: { enable: jest.fn() },
    getContext: jest.fn()
  },
  requestJira: jest.fn()
}));

test('renders loading state initially', async () => {
  // Setup mock return value inside the test
  view.getContext.mockResolvedValue({ 
      accountId: 'test-account-id',
      moduleKey: 'poker-app-main-panel'
  });

  render(<App />);
  const loadingElement = screen.getByText(/Loading.../i);
  expect(loadingElement).toBeInTheDocument();
});

test('calls view.theme.enable on mount', async () => {
  view.getContext.mockResolvedValue({ 
      accountId: 'test-account-id',
      moduleKey: 'poker-app-main-panel'
  });

  render(<App />);
  expect(view.theme.enable).toHaveBeenCalled();
});

test('renders Lobby when context is loaded but no session exists', async () => {
  view.getContext.mockResolvedValue({ 
      accountId: 'test-account-id',
      moduleKey: 'poker-app-general-page' 
  });

  render(<App />);
  
  // Wait for the async effect to finish and state to update
  // The App component renders "Loading..." first, then updates state.
  // We look for text that appears in the Lobby.
  const lobbyElement = await screen.findByText(/Dr\. Jira Poker Hub/i);
  expect(lobbyElement).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/e\.g\. GS/i)).toBeInTheDocument();
});
