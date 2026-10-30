import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from './index';

function setup(path = '/', authenticated = false) {
 const store = configureStore({ reducer: {
  auth: () => ({ isAuthenticated: authenticated }),
  cart: () => ({ cartItems: [{ quantity: 3 }] }),
 } });
 render(<Provider store={store}><MemoryRouter initialEntries={[path]}><MobileBottomNav /></MemoryRouter></Provider>);
}
test('keeps all five mobile destinations labeled and cart keyboard-accessible', () => {
 setup();
 expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
 for (const name of ['Home', 'Shop', 'Deals', 'Account', 'Cart']) expect(screen.getByRole('link', { name, exact: true })).toBeInTheDocument();
 expect(screen.getByRole('link', { name: 'Cart', exact: true })).toHaveAttribute('href', '/cart');
 expect(screen.getByText('3')).toBeInTheDocument();
});
test('marks Shop active on nested product detail URLs', () => {
 setup('/product/red-wine');
 expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
 expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});
test.each([[false, '/login'], [true, '/account']])('routes account for authenticated=%s', (authenticated, href) => {
 setup('/', authenticated);
 expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', href);
});
test.each(['/cart', '/billing'])('does not compete with the purchase action bar on %s', (path) => {
 setup(path, true);
 expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
});
