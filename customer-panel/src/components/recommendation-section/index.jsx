import React, { useEffect, useState, useRef } from "react";
import ProductService from "../../services/productService";
import ProductCard from "../product-card";
import ProductCardSkeleton from "../skeleton/productCardSkeleton";

const RecommendationSection = ({
  title = "Frequently Bought Together",
  slug,
  slugs,
  productId,
  productIds,
  limit = 4,
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Reset when inputs change.
    fetchedRef.current = false;
    setProducts([]);
    setLoading(false);
  }, [slug, slugs, productId, productIds]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      if (fetchedRef.current) return;
      if (!slug && (!slugs || slugs.length === 0)) return;

      fetchedRef.current = true;
      setLoading(true);

      try {
        // 1. Try basket-based recommendations first.
        let response;
        if (slug) {
          response = await ProductService.getRecommendationsBySlug(slug, limit);
        } else {
          response = await ProductService.getRecommendationsForCart(slugs, limit);
        }

        if (cancelled) return;

        const basketProducts =
          response?.success && Array.isArray(response.data) ? response.data : [];

        if (basketProducts.length > 0) {
          setProducts(basketProducts.slice(0, limit));
          return;
        }

        // 2. Fallback to same-category related products.
        const fallbackId = productId || (productIds && productIds[0]);
        if (!fallbackId) return;

        const related = await ProductService.getRelatedProducts(fallbackId);
        if (cancelled) return;

        if (related?.success && Array.isArray(related.data)) {
          setProducts(related.data.slice(0, limit));
        }
      } catch (error) {
        console.error("Recommendations fetch failed:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [slug, slugs, productId, productIds, limit]);

  return (
    <div className="recommendations_section mt-12">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>

      {loading ? (
        <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-5 gap-2">
          {[...Array(Math.min(limit, 4))].map((_, idx) => (
            <ProductCardSkeleton key={idx} count={1} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-5 gap-2">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={{
                id: product._id,
                slug: product.slug,
                title: product.name,
                image: product.image?.url,
                priceSale: product.priceSale,
                price: product.price,
                rating: 0,
                isWishlisted: false,
                isBestSeller: product.isBestSeller,
                isTopCollection: product.isTopCollection,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No recommendations available for this selection.</p>
      )}
    </div>
  );
};

export default RecommendationSection;
