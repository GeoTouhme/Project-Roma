// src/components/product-card/index.jsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import { Link } from "react-router-dom";
import Rating from "../rating-star";
import Icons from "../svg";
import WishlistService from "../../services/wishlistService";
import toast from "react-hot-toast";
import { getProductCardImage } from "../../utils/cloudinary";
import { ORDERING_DISABLED } from "../../config/orderingConfig";
import SaleBadge from "../sale-badge";
import CountdownTimer from "../countdown-timer";

const ProductCard = ({ product, wishListDone }) => {
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const dispatch = useDispatch();

  const handleAddToCart = () => {
    const cartItem = {
      id: product?.id,
      name: product?.title,
      image: product?.image,
      price: product?.price,
      priceSale: product?.priceSale,
      salePrice: product?.priceSale,
      quantity: 1,
      slug: product?.slug
    };
    dispatch(addToCart(cartItem));
    toast.success("Added to cart");
  };
  const handleWishlistClick = () => {
    setWishlistLoading(true)
    WishlistService.addRemoveWishlist({ pid: product?.id })
      .then((response) => {
        console.log("response = ", response);
        if (response?.success) {
          toast.success(response?.message || "Success")
        }
      })
      .catch((error) => {
        console.log("error = ", error);
      })
      .finally(() => {
        setWishlistLoading(false)
        if (wishListDone) {
          wishListDone()
        }
      })
  }

  const hasSale = product.priceSale > 0 && product.price > 0 && product.priceSale < product.price;

  return (
    <div
      key={product.id}
      className="max-w-[350px] w-full h-full flex flex-col product_item bg-white py-5 px-3 rounded-lg border border-transparent 
      hover:shadow-md transition duration-300 hover:border-primary"
    >
      <div className="product_grid_image relative pt-[100%]">
        <Link to={`/product/${product.slug}`}>
          <img
            src={getProductCardImage(product.image)}
            alt={product.title}
            className="absolute top-0 left-0 w-full h-full object-contain transform scale-75"
            loading="lazy"
          />
        </Link>
        <SaleBadge price={product.price} priceSale={product.priceSale} discount={product.discount} />
        {(product.isBestSeller || product.isTopCollection) && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-[1] items-end">
            {product.isBestSeller && (
              <span className="bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm">
                Best Seller
              </span>
            )}
            {product.isTopCollection && (
              <span className="bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm">
                Top Collection
              </span>
            )}
          </div>
        )}
      </div>

      <div className="product_info flex flex-col flex-1">
        <div className="rating_wishlist flex items-center justify-between mb-2">
          <div className="product_grid_rating">
            {product.rating !== null && <Rating rating={product.rating} />}
          </div>
          <div className="product_grid_wishlist cursor-pointer" onClick={handleWishlistClick}>
            <Icons
              name={product.isWishlisted ? "fill_wishlist" : "wishlist"}
              width={20}
              height={20}
              color={wishlistLoading ? "#bf7380" : "#B5223B"}
            // color="#bf7380"
            />
          </div>
        </div>

        <div className="product_grid_title">
          <Link to={`/product/${product.slug}`}>
            <h6 className="text-black font-medium md:text-[18px] text-[16px]">
              {product.title}
            </h6>
          </Link>
          {product.saleEndsAt && new Date(product.saleEndsAt) > new Date() && (
            <div className="mt-1">
              <CountdownTimer targetDate={product.saleEndsAt} />
            </div>
          )}
        </div>

        <div className="product_price_cart flex items-end justify-between mt-auto pt-2">
          <div className="product_grid_price">
            <p className="text-primary font-semibold md:text-[22px]/[22px] text-[18px]/[18px]">
              {hasSale ? (
                <>
                  <span className="text-gray-400 font-normal text-sm line-through mr-2">
                    ${product.price.toFixed(2)}
                  </span>
                  <span>${product.priceSale.toFixed(2)}</span>
                </>
              ) : (
                <span>${product.price > 0 ? product.price.toFixed(2) : product.priceSale?.toFixed(2)}</span>
              )}
            </p>
          </div>
          {!ORDERING_DISABLED && (
            <button
              className="product_grid_cart_btn w-11 h-11 md:w-12 md:h-12 bg-black rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              onClick={handleAddToCart}
              aria-label="Add to cart"
            >
              <Icons
                name="add_to_cart"
                width={20}
                height={20}
                color="#FFFFFF"
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
