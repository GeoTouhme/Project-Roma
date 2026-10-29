import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './index';
import WishlistService from '../../services/wishlistService';

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
jest.mock('../../services/wishlistService', () => ({ addRemoveWishlist: jest.fn() }));
jest.mock('react-hot-toast', () => ({ success: jest.fn() }));

const product = {
  id: 'product-1', title: 'Roma Ceramic Vase', slug: 'roma-ceramic-vase',
  image: '/api/images/vase.jpg', price: 40, priceSale: 30, rating: null,
};

function renderCard(overrides = {}, props = {}) {
  return render(<MemoryRouter><ProductCard product={{ ...product, ...overrides }} {...props} /></MemoryRouter>);
}

beforeEach(() => jest.clearAllMocks());

test('product-named cart action preserves the existing cart payload', () => {
  renderCard();
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'cart/addToCart',
    payload: {
      id: product.id, name: product.title, image: product.image,
      price: 40, priceSale: 30, salePrice: 30, saleEndsAt: undefined, quantity: 1, slug: product.slug,
    },
  });
});

test.each([
  [40, 30, ['$40.00', '$30.00'], true],
  [40, 0, ['$40.00'], false],
  [40, 40, ['$40.00'], false],
  [40, 50, ['$40.00'], false],
])('preserves price presentation for base %s and sale %s', (price, priceSale, amounts, sale) => {
  const { container } = renderCard({ price, priceSale });
  const prices = container.querySelector('.product_grid_price');
  expect(Array.from(prices.querySelectorAll('span'), span => span.textContent)).toEqual(amounts);
  expect(Boolean(prices.querySelector('.line-through'))).toBe(sale);
});

test('CSV product (null base price, sale-only price) renders its real price — never $0.00', () => {
  const { container } = renderCard({ price: null, priceSale: 23.99 });
  const prices = container.querySelector('.product_grid_price');
  expect(Array.from(prices.querySelectorAll('span'), span => span.textContent)).toEqual(['$23.99']);
  expect(prices.querySelector('.line-through')).toBeNull();
});

test('CSV product keeps its sale-only price in the cart payload', () => {
  renderCard({ price: null, priceSale: 23.99 });
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  const payload = mockDispatch.mock.calls[0][0].payload;
  expect(payload.price).toBe(null);            // raw base price preserved for the backend
  expect(payload.priceSale).toBe(23.99);       // effective selling price
  expect(payload.salePrice).toBe(23.99);
});

test('unpriced product (no valid price) is not purchasable — no $0.00 card price, no cart button', () => {
  const { container } = renderCard({ price: null, priceSale: null });
  const prices = container.querySelector('.product_grid_price');
  expect(prices.textContent).toBe('Price unavailable');
  expect(screen.queryByRole('button', { name: /add to cart/i })).toBeNull();
});
