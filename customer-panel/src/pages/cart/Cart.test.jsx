import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Cart from './Cart';
import cartReducer from '../../redux/cartSlice';
import { refreshCartProducts } from '../../utils/cartRepricing';
import OrderService from '../../services/orderService';
import ProductService from '../../services/productService';

jest.mock('../../utils/cartRepricing', () => ({ refreshCartProducts: jest.fn() }), { virtual: true });
jest.mock('../../services/orderService', () => ({ getCartSummary: jest.fn() }));
jest.mock('../../services/productService', () => ({ allProducts: jest.fn() }));
jest.mock('../../components/recommendation-section', () => () => null);
jest.mock('../../components/breadcrumb', () => () => null);
jest.mock('../../config/orderingConfig', () => ({ ORDERING_DISABLED: false }));
const id = '6a78dc08c9338c2d3e71fb52';
const stale = { id, name: 'CONUNDRUM WHITE', price: null, priceSale: 0, salePrice: 0, quantity: 2 };
const fresh = { id, name: stale.name, price: null, priceSale: 23.99, salePrice: 23.99, pricingStatus: 'ready' };
function show(items = [stale], authenticated = false) {
  const store = configureStore({ reducer: {
    cart: cartReducer, auth: (s = { isAuthenticated: authenticated }) => s,
    storeStatus: (s = { isOpen: true }) => s,
  }, preloadedState: { cart: { cartItems: items } } });
  return { store, ...render(<Provider store={store}><MemoryRouter><Cart /></MemoryRouter></Provider>) };
}
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });
test('anonymous stale cart hides zero during loading, then uses fresh prices and persists raw data', async () => {
  let resolve;
  refreshCartProducts.mockReturnValue(new Promise(r => { resolve = r; }));
  const { store } = show();
  expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  for (const button of screen.getAllByRole('button', { name: /proceed to checkout/i })) expect(button).toBeDisabled();
  await act(async () => resolve([fresh]));
  expect(screen.getAllByText('$47.98').length).toBeGreaterThan(0);
  expect(store.getState().cart.cartItems[0]).toMatchObject({ priceSale: 23.99, quantity: 2 });
  expect(JSON.parse(localStorage.getItem('cartItems'))[0].priceSale).toBe(23.99);
  expect(OrderService.getCartSummary).not.toHaveBeenCalled();
  for (const button of screen.getAllByRole('button', { name: /proceed to checkout/i })) expect(button).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  expect(screen.getAllByText('$71.97').length).toBeGreaterThan(0);
  expect(refreshCartProducts).toHaveBeenCalledTimes(1);
});
test('failed public lookup hides totals, retains item, blocks checkout and supports retry', async () => {
  refreshCartProducts.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([fresh]);
  const { store } = show([{ ...stale, priceSale: 99 }]);
  await screen.findByRole('button', { name: /retry prices/i });
  expect(screen.getAllByText('Price unavailable').length).toBeGreaterThan(0);
  expect(screen.queryByText(/\$0\.00|\$198\.00/)).not.toBeInTheDocument();
  expect(store.getState().cart.cartItems).toHaveLength(1);
  for (const button of screen.getAllByRole('button', { name: /proceed to checkout/i })) expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /retry prices/i }));
  await screen.findAllByText('$47.98');
});
test('deleted/unpriced lines stay visible and do not produce a partial cart total', async () => {
  refreshCartProducts.mockResolvedValue([{ ...fresh, pricingStatus: 'unavailable', priceSale: null }]);
  const { store } = show();
  await screen.findByRole('button', { name: /retry prices/i });
  expect(screen.getByText(stale.name)).toBeInTheDocument();
  expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  expect(store.getState().cart.cartItems).toHaveLength(1);
});
test('authenticated carts still use protected server summary, not public pricing', async () => {
  OrderService.getCartSummary.mockResolvedValue({ success: true, data: { subtotal: 47.98, total: 52.66, tax: 3.72, markup: .96, items: [{ pid: id, unitPrice: 23.99 }] } });
  show([stale], true);
  await screen.findAllByText('$52.66');
  expect(refreshCartProducts).not.toHaveBeenCalled();
  expect(OrderService.getCartSummary).toHaveBeenCalledTimes(1);
});
test('restoring a previously verified cart still refreshes from the public API', async () => {
  refreshCartProducts.mockResolvedValue([fresh]);
  const first = show([{ ...stale, priceSale: 1, pricingStatus: 'ready' }]);
  await screen.findAllByText('$47.98');
  first.unmount();
  show(JSON.parse(localStorage.getItem('cartItems')));
  await waitFor(() => expect(refreshCartProducts).toHaveBeenCalledTimes(2));
});
test('actual public hydration keeps deleted product identity for removal and retry', async () => {
  ProductService.allProducts.mockResolvedValue({ success: true, data: [] });
  refreshCartProducts.mockImplementation(jest.requireActual('../../utils/cartRepricing').refreshCartProducts);
  show();
  await screen.findByRole('button', { name: /retry prices/i });
  expect(screen.getByText(stale.name)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove item' })).toBeEnabled();
});
test('authenticated summary failure cannot fall back to persisted prices or allow checkout', async () => {
  OrderService.getCartSummary.mockRejectedValue(new Error('offline'));
  show([{ ...stale, priceSale: 23.99 }], true);
  await screen.findByRole('button', { name: /retry prices/i });
  expect(screen.queryByText('$47.98')).not.toBeInTheDocument();
  for (const button of screen.getAllByRole('button', { name: /proceed to checkout/i })) expect(button).toBeDisabled();
});
test('a response for a removed cart line cannot resurrect it', async () => {
  let resolve;
  refreshCartProducts.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { store } = show();
  fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
  await act(async () => resolve([fresh]));
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  expect(store.getState().cart.cartItems).toEqual([]);
});
test('an anonymous bundle cannot reuse a regular-product quote with the same ID', async () => {
  refreshCartProducts.mockResolvedValue([fresh, { id, pricingStatus: 'unavailable' }]);
  show([stale, { ...stale, type: 'bundle', id, name: 'Bundle', bundlePrice: 1 }]);
  await screen.findByRole('button', { name: /retry prices/i });
  for (const button of screen.getAllByRole('button', { name: /proceed to checkout/i })) expect(button).toBeDisabled();
});
test('anonymous bundle display gating does not invalidate the saved authenticated bundle', async () => {
  refreshCartProducts.mockResolvedValue([{ id, pricingStatus: 'unavailable', price: null, priceSale: null }]);
  const bundle = { ...stale, type: 'bundle', name: 'Bundle', bundlePrice: 25 };
  const { store } = show([bundle]);
  await screen.findByRole('button', { name: /retry prices/i });
  expect(screen.getByRole('button', { name: /sign in to verify bundle prices/i })).toBeEnabled();
  expect(store.getState().cart.cartItems[0]).toEqual(bundle);
});
