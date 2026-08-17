import React from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { getProductCardImage } from "../../utils/cloudinary";
import { addBundleToCart } from "../../redux/cartSlice";
import { toast } from "react-hot-toast";
import { ShoppingCart } from "lucide-react";

const DealCard = ({ deal }) => {
  const dispatch = useDispatch();
  const products = deal.productIds || [];

  const handleAddToCart = () => {
    dispatch(
      addBundleToCart({
        id: deal._id,
        type: "bundle",
        name: deal.name,
        description: deal.description,
        bundlePrice: Number(deal.bundlePrice),
        quantity: Number(deal.quantity),
        price: Number(deal.bundlePrice),
        priceSale: Number(deal.bundlePrice),
        image: products[0]?.images?.[0]?.url || "",
        products: products.map((p) => ({
          id: p._id,
          name: p.name,
          slug: p.slug,
          image: p.images?.[0]?.url || "",
          price: p.price || p.priceSale || 0,
          priceSale: p.priceSale || p.price || 0,
        })),
      })
    );
    toast.success(`Added ${deal.name} to cart`);
  };

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
      <button
        onClick={handleAddToCart}
        className="bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 hover:bg-opacity-90 transition"
      >
        <ShoppingCart className="w-4 h-4" /> Add to Cart
      </button>
    </div>
  );
};

export default DealCard;
