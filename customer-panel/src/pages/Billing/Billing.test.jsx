import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Billing from './Billing';
import OrderService from '../../services/orderService';
import PaymentService from '../../services/paymentService';

const mockElements = { update: jest.fn(), submit: jest.fn() };
const mockStripe = { confirmPayment: jest.fn() };
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => children,
  PaymentElement: () => <div data-testid="payment-element" />,
  useElements: () => mockElements,
  useStripe: () => mockStripe,
}));
jest.mock('../../config/stripe', () => ({ stripePromise: {} }));
jest.mock('../../services/orderService', () => ({ getCheckoutPolicy: jest.fn(), getCartSummary: jest.fn() }));
jest.mock('../../services/paymentService', () => ({ paymentIntentCreate: jest.fn() }));
jest.mock('../../services/couponService', () => ({ getActive: jest.fn().mockResolvedValue({ success: true, data: [] }) }));

const product = { id: 'product-1', name: 'Wine', image: 'https://example.com/wine.jpg', price: null, priceSale: 23.99, quantity: 2 };
function show(item) {
  const items = [item];
  const store = configureStore({ reducer: {
    cart: (state = { cartItems: items }) => state,
    storeStatus: (state = { isOpen: true }) => state,
  } });
  return { store, ...render(<Provider store={store}><MemoryRouter><Billing /></MemoryRouter></Provider>) };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('user', JSON.stringify({ email: 'buyer@example.com' }));
  process.env.REACT_APP_STRIPE_PUBLIC_KEY = 'pk_test_example';
  OrderService.getCartSummary.mockResolvedValue({ success: true, data: { subtotal: 47.98, tax: 3.72, markup: .96, total: 52.66 } });
});

test('persisted unavailable pricing hides prices and payment actions even with a cached positive price', async () => {
  const item = { ...product, pricingStatus: 'unavailable' };
  const { store } = show(item);
  expect(screen.getByRole('heading', { name: 'Price unavailable' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /return to cart.*retry/i })).toHaveAttribute('href', '/cart');
  await act(async () => {});
  expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
  expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /order|verify delivery/i })).not.toBeInTheDocument();
  expect(store.getState().cart.cartItems).toEqual([item]);
  expect(mockElements.submit).not.toHaveBeenCalled();
  expect(PaymentService.paymentIntentCreate).not.toHaveBeenCalled();
  expect(mockStripe.confirmPayment).not.toHaveBeenCalled();
});

test('unpriced products stay blocked and retained when the server refresh fails', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    OrderService.getCartSummary.mockRejectedValue(new Error('offline'));
    const item = { ...product, priceSale: null };
    const { store } = show(item);
    expect(screen.getByRole('heading', { name: 'Price unavailable' })).toBeInTheDocument();
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Price unavailable' })).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    expect(store.getState().cart.cartItems).toEqual([item]);
    expect(mockElements.submit).not.toHaveBeenCalled();
    expect(PaymentService.paymentIntentCreate).not.toHaveBeenCalled();
    expect(mockStripe.confirmPayment).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith('Failed to load cart summary:', expect.any(Error));
  } finally {
    errorLog.mockRestore();
  }
});

test('valid sale-only products use authoritative summary line pricing without being gated', async () => {
  OrderService.getCartSummary.mockResolvedValue({ success: true, data: {
    subtotal: 50, tax: 3.88, markup: 1, total: 54.88,
    items: [{ pid: product.id, quantity: 2, unitPrice: 25 }],
  } });
  show(product);
  await screen.findAllByText('$54.88');
  expect(screen.queryByRole('heading', { name: 'Price unavailable' })).not.toBeInTheDocument();
  expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  expect(screen.queryByText('$47.98')).not.toBeInTheDocument();
  expect(screen.getAllByText('$50.00')).toHaveLength(2);
});
