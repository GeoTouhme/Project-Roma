import React from "react";
import { Link } from "react-router-dom";
import { getProductCardImage } from "../../utils/cloudinary";

const DealCard = ({ deal }) => {
  const products = deal.productIds || [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition">
      <div className="flex gap-2 mb-3">
        {products.slice(0, 3).map((p) => (
          <img
            key={p._id}
            src={getProductCardImage(p.images?.[0]?.url)}
            alt={p.name}
            className="w-16 h-16 object-contain border rounded"
          />
        ))}
      </div>
      <h3 className="font-semibold text-lg mb-1">{deal.name}</h3>
      {deal.description && <p className="text-gray-500 text-sm mb-2">{deal.description}</p>}
      <p className="text-primary font-bold text-xl mb-3">
        Buy {deal.quantity} for ${Number(deal.bundlePrice).toFixed(2)}
      </p>
      <Link
        to={`/deals?deal=${deal._id}`}
        className="bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold inline-block"
      >
        Shop Now
      </Link>
    </div>
  );
};

export default DealCard;
