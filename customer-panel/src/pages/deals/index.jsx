import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ProductService from "../../services/productService";
import HomeService from "../../services/homeService";
import ProductCard from "../../components/product-card";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";
import { safeJSONParse } from "../../utils/safeStorage";

const Deals = () => {
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal");
  const mixBundleId = searchParams.get("mix");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeDeal, setActiveDeal] = useState(null);
  const [activeMixBundle, setActiveMixBundle] = useState(null);
  const isAuthenticated = safeJSONParse("isAuthenticated", false);
  const userInfo = isAuthenticated ? safeJSONParse("user", null) : null;
  const user_id = userInfo?._id || "";

  const fetchDealProducts = useCallback(() => {
    if (!dealId) return;
    setLoading(true);
    HomeService.activeDeals()
      .then((res) => {
        if (res?.success) {
          const deal = (res.data || []).find((d) => d._id === dealId);
          setActiveDeal(deal || null);
          if (deal) {
            const ids = (deal.productIds || []).map((p) => p._id || p).join(",");
            return ProductService.allProducts({ user_id, ids, limit: 100 });
          }
        }
        return { success: false };
      })
      .then((res) => {
        if (res?.success) setProducts(res?.data || []);
      })
      .catch((err) => console.log("bundle deal error", err))
      .finally(() => setLoading(false));
  }, [dealId, user_id]);

  const fetchMixBundleProducts = useCallback(() => {
    if (!mixBundleId) return;
    setLoading(true);
    HomeService.activeMixBundles()
      .then((res) => {
        if (res?.success) {
          const bundle = (res.data || []).find((b) => b._id === mixBundleId);
          setActiveMixBundle(bundle || null);
          if (bundle) {
            const conds = bundle.conditions || [];
            const params = { user_id, limit: 100 };
            conds.forEach((c) => {
              const vals = Array.isArray(c.value) ? c.value : [c.value];
              if (c.field === 'category') params.categories = vals.join(",");
              if (c.field === 'brand') params.brands = vals.join(",");
              if (c.field === 'size') params.sizes = vals.join(",");
              if (c.field === 'tag') params.tags = vals.join(",");
            });
            return ProductService.allProducts(params);
          }
        }
        return { success: false };
      })
      .then((res) => {
        if (res?.success) setProducts(res?.data || []);
      })
      .catch((err) => console.log("mix bundle error", err))
      .finally(() => setLoading(false));
  }, [mixBundleId, user_id]);

  const fetchDiscountProducts = useCallback(() => {
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
    if (dealId) {
      fetchDealProducts();
    } else if (mixBundleId) {
      fetchMixBundleProducts();
    } else {
      fetchDiscountProducts();
    }
  }, [dealId, mixBundleId, fetchDealProducts, fetchMixBundleProducts, fetchDiscountProducts]);

  const title = activeDeal?.name || activeMixBundle?.name || "Deals & Offers";
  const subtitle = activeDeal
    ? `Buy ${activeDeal.quantity} for $${Number(activeDeal.bundlePrice).toFixed(2)}`
    : activeMixBundle
      ? `Buy any ${activeMixBundle.requiredQty} matching items for $${Number(activeMixBundle.bundlePrice).toFixed(2)}`
      : "Best savings, updated daily.";

  return (
    <div className="main py-10">
      <div className="container">
        <div className="text-center mb-10">
          <h1 className="md:text-[45px]/[50px] text-[30px]/[36px] font-semibold text-black mb-3">
            {title}
          </h1>
          <p className="text-gray-500 text-lg">{subtitle}</p>
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
                  image: product.image,
                  priceSale: product.priceSale,
                  price: product.price,
                  discount: product.discount,
                  rating: product.averageRating || 0,
                  isWishlisted: product.isWishlisted,
                  isBestSeller: product.isBestSeller,
                  isTopCollection: product.isTopCollection,
                }}
                wishListDone={() => {
                  if (dealId) fetchDealProducts();
                  else if (mixBundleId) fetchMixBundleProducts();
                  else fetchDiscountProducts();
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Deals;
