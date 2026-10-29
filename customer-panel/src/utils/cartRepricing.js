import ProductService from '../services/productService';
import { sellingPrice } from './salePricing';

// Saved labels are display-only; no persisted price or verification is reused.
const unavailable = item => ({ id: item.id, price: null, priceSale: null, salePrice: null, saleEndsAt: null, name: item.name ?? null, slug: item.slug ?? null, image: item.image ?? null, available: 0, pricingStatus: 'unavailable' });

export async function refreshCartProducts(items) {
  const eligible = item => item.type !== 'bundle' && typeof item.id === 'string' && /^[a-f\d]{24}$/i.test(item.id);
  const ids = [...new Set(items.filter(eligible).map(item => item.id))];
  const products = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    try {
      const response = await ProductService.allProducts({ ids: batch.join(','), limit: batch.length, page: 1 });
      // The public controller returns { success: true, data: Product[] }.
      if (response?.success !== true || !Array.isArray(response.data) ||
          !response.data.every(product => product && typeof product._id === 'string')) continue;
      products.push(...response.data.filter(product => batch.includes(product._id)));
    } catch {
      // Leave this entire batch unavailable; another batch may still succeed.
    }
  }
  return items.map(item => {
    if (!eligible(item)) return unavailable(item);
    const product = products.find(product => product._id === item.id);
    if (!product || sellingPrice(product) === null || !Number.isFinite(Number(product.available)) || Number(product.available) <= 0) return unavailable(item);
    return {
      id: item.id,
      price: product.price ?? null,
      priceSale: product.priceSale ?? null,
      salePrice: product.priceSale ?? null,
      saleEndsAt: product.saleEndsAt ?? null,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0],
      available: product.available,
      pricingStatus: 'ready',
    };
  });
}
