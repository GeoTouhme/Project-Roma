import React from "react";

const SaleBadge = ({ price, priceSale, discount }) => {
  const percent =
    discount > 0
      ? Math.round(discount)
      : price > 0 && priceSale > 0 && priceSale < price
      ? Math.round(((price - priceSale) / price) * 100)
      : 0;

  if (!percent) return null;

  return (
    <span className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[11px] md:text-xs font-bold px-2 py-1 rounded-full shadow-sm">
      -{percent}%
    </span>
  );
};

export default SaleBadge;
