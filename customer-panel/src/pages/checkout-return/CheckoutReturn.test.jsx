import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutReturn from './index';
import OrderService from '../../services/orderService';

const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
let mockAuthenticated = true;
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch, useSelector: callback => callback({ auth: { isAuthenticated: mockAuthenticated } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../../services/orderService', () => ({ recoverCheckout: jest.fn(), cancelUnpaidCheckout: jest.fn() }));
jest.mock('../../redux/cartSlice', () => ({ clearCart: () => ({ type: 'cart/clearCart' }) }));

beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); mockAuthenticated = true;
  window.history.replaceState({}, '', '/checkout/return');
});
test('completed checkout clears the pending reference and cart, and opens the existing order', async () => {
  sessionStorage.setItem('pending_checkout_id', 'c'.repeat(64));
  OrderService.recoverCheckout.mockResolvedValue({ success: true, state: 'completed', orderId: 'order-fixture' });
  render(<CheckoutReturn />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/order/order-fixture', { replace: true }));
  expect(OrderService.recoverCheckout).toHaveBeenCalledWith({ checkoutId: 'c'.repeat(64), paymentId: null });
  expect(sessionStorage.getItem('pending_checkout_id')).toBeNull();
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'cart/clearCart' });
});
test('Stripe return query is scrubbed and only the payment ID is used for authenticated recovery', async () => {
  window.history.replaceState({}, '', '/checkout/return?payment_intent=pi_fixture&payment_intent_client_secret=synthetic_secret');
  OrderService.recoverCheckout.mockResolvedValue({ state: 'manual_review', message: 'Do not pay again.' });
  render(<CheckoutReturn />);
  await waitFor(() => expect(OrderService.recoverCheckout).toHaveBeenCalledWith({ checkoutId: null, paymentId: 'pi_fixture' }));
  expect(window.location.search).toBe('');
  expect(sessionStorage.getItem('pending_payment_id')).toBe('pi_fixture');
  expect(JSON.stringify(sessionStorage)).not.toContain('synthetic_secret');
  expect(mockDispatch).not.toHaveBeenCalled();
});
test('unauthenticated customers are asked to sign in without submitting recovery requests', () => {
  mockAuthenticated = false; sessionStorage.setItem('pending_checkout_id', 'c'.repeat(64));
  render(<CheckoutReturn />);
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(OrderService.recoverCheckout).not.toHaveBeenCalled();
});
test('temporary recovery errors preserve the pending reference and do not clear the basket or charge again', async () => {
  sessionStorage.setItem('pending_checkout_id', 'c'.repeat(64));
  OrderService.recoverCheckout.mockRejectedValue(new Error('Recovery unavailable. Do not pay again.'));
  render(<CheckoutReturn />);
  expect(await screen.findByRole('status')).toHaveTextContent('Do not pay again');
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Recovery unavailable'));
  expect(sessionStorage.getItem('pending_checkout_id')).toBe('c'.repeat(64));
  expect(mockDispatch).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
});
test('a confirmed cancellation of an unpaid attempt is required before a fresh checkout', async () => {
  sessionStorage.setItem('pending_checkout_id', 'c'.repeat(64));
  OrderService.recoverCheckout.mockResolvedValue({ state: 'payment_incomplete', message: 'Payment was not completed.' });
  OrderService.cancelUnpaidCheckout.mockResolvedValue({ state: 'cancelled' });
  render(<CheckoutReturn />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel unpaid attempt and return to checkout' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/billing'));
  expect(OrderService.cancelUnpaidCheckout).toHaveBeenCalledWith('c'.repeat(64));
  expect(sessionStorage.getItem('pending_checkout_id')).toBeNull();
});
