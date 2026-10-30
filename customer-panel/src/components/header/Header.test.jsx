import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './index';
import SearchService from '../../services/searchService';

jest.mock('../promo-banner', () => () => null);
jest.mock('../../services/searchService', () => ({ getSuggestions: jest.fn() }));

function Location() { return <div aria-label="Current path">{useLocation().pathname + useLocation().search}</div>; }
function setup(path = '/', authenticated = false) {
  const store = configureStore({ reducer: {
    auth: () => ({ isAuthenticated: authenticated }),
    cart: () => ({ cartItems: [{ id: 'one', quantity: 2 }] }),
  } });
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Header /><Location /></MemoryRouter></Provider>);
}
beforeEach(() => { jest.clearAllMocks(); SearchService.getSuggestions.mockResolvedValue({ success: true, products: [], categories: [] }); });

test('provides one persistently labeled search and no duplicate menu drawer', () => {
  setup();
  expect(screen.getAllByRole('searchbox', { name: 'Search products' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
});
test('marks only the current top-level destination active', () => {
  setup('/products/wine');
  expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});
test('uses Redux authentication for the account destination', () => {
  setup('/', true);
  expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
});
test('submits the trimmed search using the existing catalog URL', () => {
  setup();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: ' red wine ' } });
  fireEvent.submit(screen.getByRole('search', { name: 'Product search' }));
  expect(screen.getByLabelText('Current path')).toHaveTextContent('/products?search=red%20wine');
});
test('shows a recoverable search error rather than a false empty result', async () => {
  SearchService.getSuggestions.mockRejectedValue(new Error('offline'));
  setup();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'wine' } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Suggestions are unavailable'), { timeout: 2000 });
  expect(screen.getByRole('button', { name: 'Search all products' })).toBeInTheDocument();
});
test('Escape from a suggestion closes it and restores search focus', async () => {
  SearchService.getSuggestions.mockResolvedValue({ success: true, products: [{ _id: 'one', name: 'Red wine', slug: 'red-wine', price: 10 }], categories: [] });
  setup();
  const input = screen.getByRole('searchbox', { name: 'Search products' });
  fireEvent.change(input, { target: { value: 'wine' } });
  const suggestion = await screen.findByRole('link', { name: /Red wine/ });
  suggestion.focus();
  fireEvent.keyDown(suggestion, { key: 'Escape' });
  expect(screen.queryByRole('link', { name: /Red wine/ })).not.toBeInTheDocument();
  expect(input).toHaveFocus();
});
