import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordRecovery from './PasswordRecovery';
import AuthService from '../../services/authServices';

const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
let mockLocation = { pathname: '/forgot-password', hash: '' };
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
// CRA's Jest resolver predates react-router-dom's package exports.
jest.mock('react-router-dom', () => ({
  useLocation: () => mockLocation, useNavigate: () => mockNavigate,
  Link: ({ children }) => <span>{children}</span>,
}), { virtual: true });
jest.mock('../../services/authServices', () => ({
  forgetPassword: jest.fn(), resetPassword: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation = { pathname: '/forgot-password', hash: '' };
});

test('forgot-password sends only email and shows the generic response', async () => {
  AuthService.forgetPassword.mockResolvedValue({ success: true, message: 'If an account exists, check your email.' });
  render(<PasswordRecovery />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  await waitFor(() => expect(AuthService.forgetPassword).toHaveBeenCalledWith({ email: 'customer@example.test' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If an account exists');
});

test('reset reads token from fragment, submits password, clears browser auth, and leaves the token URL', async () => {
  mockLocation = { pathname: '/auth/reset-password', hash: '#token=dummy-token' };
  AuthService.resetPassword.mockResolvedValue({ success: true });
  render(<PasswordRecovery />);
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
  await waitFor(() => expect(AuthService.resetPassword).toHaveBeenCalledWith({ token: 'dummy-token', newPassword: 'new-password' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }));
  expect(mockDispatch).toHaveBeenCalled();
});

test('reset without a credential cannot submit', () => {
  mockLocation = { pathname: '/auth/reset-password', hash: '' };
  render(<PasswordRecovery />);
  expect(screen.getByRole('alert')).toHaveTextContent('missing or invalid');
  expect(screen.queryByRole('button', { name: 'Save password' })).not.toBeInTheDocument();
});
