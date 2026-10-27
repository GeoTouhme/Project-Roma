import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/authSlice';
import AuthService from '../../services/authServices';

export default function PasswordRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const resetting = location.pathname === '/auth/reset-password';
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (resetting && password !== confirmation) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const response = resetting
        ? await AuthService.resetPassword({ token, newPassword: password })
        : await AuthService.forgetPassword({ email });
      if (!response.success) throw new Error(response.message || 'Please try again.');
      if (resetting) {
        dispatch(logout());
        navigate('/login', { replace: true });
      } else {
        setMessage(response.message);
      }
    } catch (failure) {
      // Do not log request objects: they contain the reset token and new password.
      setError(failure.message || 'Unable to complete the request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">{resetting ? 'Reset password' : 'Forgot password'}</h1>
      {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
      {message ? <p role="status">{message}</p> : resetting && !token ? (
        <p role="alert">This reset link is missing or invalid. Please request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {resetting ? <>
            <label className="block">New password
              <input className="block w-full border rounded p-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            <label className="block">Confirm new password
              <input className="block w-full border rounded p-2" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            </label>
          </> : (
            <label className="block">Email
              <input className="block w-full border rounded p-2" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
            </label>
          )}
          <button disabled={busy} className="w-full rounded bg-[#B5223B] text-white p-3 disabled:opacity-50" type="submit">
            {busy ? 'Please wait…' : resetting ? 'Save password' : 'Send reset link'}
          </button>
        </form>
      )}
      <Link className="block mt-6 underline" to={resetting ? '/forgot-password' : '/login'}>{resetting ? 'Request a new reset link' : 'Back to login'}</Link>
    </main>
  );
}
