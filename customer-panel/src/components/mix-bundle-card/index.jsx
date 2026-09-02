import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductService from "../../services/productService";
import { resolveImageUrl } from "../../utils/cloudinary";

const FIELD_LABELS = {
  category: "Category",
  size: "Size",
  brand: "Brand",
  tag: "Tag",
};

const MixBundleCard = ({ bundle, categories = [] }) => {
  const [sampleImage, setSampleImage] = useState("");
  const conditions = useMemo(() => bundle.conditions || [], [bundle.conditions]);

  const categoryMap = new Map(
    categories.map((c) => [c._id?.toString?.() || c._id, c])
  );

  // Prefer the first category condition for link + banner.
  const categoryCondition = conditions.find((c) => c.field === "category");
  const categoryIds = categoryCondition
    ? Array.isArray(categoryCondition.value)
      ? categoryCondition.value
      : [categoryCondition.value]
    : [];
  const primaryCategory = categoryMap.get(categoryIds[0]);

  useEffect(() => {
    if (primaryCategory?.cover?.url) return;
    let cancelled = false;
    const params = { limit: 1 };
    conditions.forEach((c) => {
      const vals = Array.isArray(c.value) ? c.value : [c.value];
      if (c.field === "category") params.categories = vals.join(",");
      if (c.field === "brand") params.brands = vals.join(",");
      if (c.field === "size") params.sizes = vals.join(",");
      if (c.field === "tag") params.tags = vals.join(",");
    });
    ProductService.allProducts(params)
      .then((res) => {
        if (cancelled || !res?.success || !res?.data?.length) return;
        setSampleImage(res.data[0].image?.url || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conditions, primaryCategory?.cover?.url]);

  const readableLabel = conditions
    .map((c) => {
      const fieldLabel = FIELD_LABELS[c.field] || c.field;
      let valueLabel = Array.isArray(c.value) ? c.value.join(" | ") : c.value;
      if (c.field === "category") {
        const ids = Array.isArray(c.value) ? c.value : [c.value];
        valueLabel = ids
          .map((id) => categoryMap.get(id)?.name || id)
          .join(" | ");
      }
      return `${fieldLabel}: ${valueLabel}`;
    })
    .join(" · ");

  const bannerUrl = primaryCategory?.cover
    ? resolveImageUrl(primaryCategory.cover, {
        width: 600,
        height: 300,
        crop: "fill",
        quality: "auto",
      })
    : sampleImage || bundle.image || "/placeholder-bundle.jpg";

  const shopLink = primaryCategory
    ? `/products/${primaryCategory.slug}`
    : `/deals?mix=${bundle._id}`;

  return (
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        <img
          src={bannerUrl}
          alt={bundle.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-bundle.jpg";
          }}
        />
        <div className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
          Mix & Match
        </div>
        {primaryCategory && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <p className="text-white font-semibold text-sm">{primaryCategory.name}</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 truncate">{bundle.name}</h3>
        {bundle.description && (
          <p className="text-gray-500 text-sm mb-2 line-clamp-2">{bundle.description}</p>
        )}
        <p className="text-xs text-gray-500 mb-3 truncate">{readableLabel}</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-gray-400 text-xs">bundle price</p>
            <p className="text-primary font-bold text-2xl">
              ${Number(bundle.bundlePrice).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">Buy any</p>
            <p className="font-semibold text-gray-900">{bundle.requiredQty}</p>
          </div>
        </div>
        <Link
          to={shopLink}
          className="block w-full text-center bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-opacity-90 transition"
        >
          Shop Now
        </Link>
      </div>
    </div>
  );
};

export default MixBundleCard;
