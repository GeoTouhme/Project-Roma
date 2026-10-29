import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Billing from './Billing';
import OrderService from '../../services/orderService';
const mockElements = { update: jest.fn() };
jest.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }) => children, PaymentElement: () => <div data-testid="payment-element" />, useElements: () => mockElements, useStripe: () => ({}) }));
jest.mock('../../config/stripe', () => ({ stripePromise: {} }));
jest.mock('../../services/orderService', () => ({ getCheckoutPolicy: jest.fn(), getCartSummary: jest.fn() }));
jest.mock('../../services/couponService', () => ({ getActive: jest.fn().mockResolvedValue({ success: true, data: [] }) }));
test('a successful authoritative summary repairs the display of an authenticated stale cart at Billing', async () => {
  localStorage.clear(); sessionStorage.clear();
  process.env.REACT_APP_STRIPE_PUBLIC_KEY = 'pk_test_example';
  OrderService.getCartSummary.mockResolvedValue({ success: true, data: {
    subtotal: 47.98, tax: 3.72, markup: .96, total: 52.66,
    items: [{ pid: 'stale', quantity: 2, unitPrice: 23.99 }],
  } });
  const store = configureStore({ reducer: {
    cart: (s = { cartItems: [{ id: 'stale', name: 'Wine', price: null, priceSale: 0, quantity: 2, pricingStatus: 'unavailable' }] }) => s,
    storeStatus: (s = { isOpen: true }) => s,
  } });
  render(<Provider store={store}><MemoryRouter><Billing /></MemoryRouter></Provider>);
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  await screen.findAllByText('$52.66');
  expect(screen.queryByRole('heading', { name: 'Price unavailable' })).not.toBeInTheDocument();
  expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  expect(screen.getAllByText('$47.98').length).toBeGreaterThan(0);
});
