import React, { useEffect, useState, useCallback } from "react";
import ProductService from "../../services/productService";
import ProductCard from "../../components/product-card";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";
import { safeJSONParse } from "../../utils/safeStorage";

const Deals = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const isAuthenticated = safeJSONParse("isAuthenticated", false);
  const userInfo = isAuthenticated ? safeJSONParse("user", null) : null;
  const user_id = userInfo?._id || "";

  const fetchDeals = useCallback(() => {
    setLoading(true);
    ProductService.allProducts({
      user_id,
      hasDiscount: true,
      limit: 48,
    })
      .then((res) => {
        if (res?.success) setProducts(res?.data || []);
      })
      .catch((err) => console.log("deals error", err))
      .finally(() => setLoading(false));
  }, [user_id]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="main py-10">
      <div className="container">
        <div className="text-center mb-10">
          <h1 className="md:text-[45px]/[50px] text-[30px]/[36px] font-semibold text-black mb-3">
            Deals & Offers
          </h1>
          <p className="text-gray-500 text-lg">Best savings, updated daily.</p>
        </div>
        <div className="products_list grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 md:gap-7 gap-2">
          {loading ? (
            <ProductCardSkeleton count={20} />
          ) : (
            products.map((product) => (
              <ProductCard
                key={product._id}
                product={{
                  id: product._id,
                  slug: product.slug,
                  title: product.name,
                  image: product.image?.url,
                  priceSale: product.priceSale,
                  price: product.price,
                  discount: product.discount,
                  rating: product.averageRating || 0,
                  isWishlisted: product.isWishlisted,
                  isBestSeller: product.isBestSeller,
                  isTopCollection: product.isTopCollection,
                }}
                wishListDone={() => fetchDeals()}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Deals;
