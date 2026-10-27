import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AuthService from '../../services/authServices';

process.env.REACT_APP_GOOGLE_CLIENT_ID = 'dummy-google-client';
const GoogleSignInButton = require('./GoogleSignInButton').default;
const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
// CRA's Jest resolver predates react-router-dom's package exports.
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('react-hot-toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../services/authServices', () => ({ googleAuth: jest.fn(), verifyMfa: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  window.google = { accounts: { id: { initialize: jest.fn(), renderButton: jest.fn() } } };
});

test('Google MFA challenge is not treated as login; only a completed TOTP response signs in', async () => {
  AuthService.googleAuth.mockResolvedValue({ success: true, mfaRequired: true, tempToken: 'dummy-challenge' });
  AuthService.verifyMfa.mockResolvedValue({ success: true, user: { _id: 'dummy-user' } });
  render(<GoogleSignInButton />);
  await waitFor(() => expect(window.google.accounts.id.initialize).toHaveBeenCalled());
  const callback = window.google.accounts.id.initialize.mock.calls[0][0].callback;
  await act(() => callback({ credential: 'mock-google-credential' }));
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(localStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  await waitFor(() => expect(AuthService.verifyMfa).toHaveBeenCalledWith({ tempToken: 'dummy-challenge', code: '123456' }));
  await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  expect(mockNavigate).toHaveBeenCalledWith('/');
  expect(localStorage.getItem('user')).toContain('dummy-user');
  expect(localStorage.getItem('token')).toBeNull();
});
