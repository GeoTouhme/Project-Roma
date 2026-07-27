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

  return (
    <div
      key={product.id}
      className="max-w-[350px] product_item bg-white py-5 px-3 rounded-lg border border-transparent 
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
      </div>

      <div className="product_info">
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
          <Link to={`/product/${product.id}`}>
            <h6 className="text-black font-medium md:text-[18px] text-[16px]">
              {product.title}
            </h6>
          </Link>
        </div>

        <div className="product_price_cart flex items-end justify-between mt-2">
          <div className="product_grid_price">
            <p className="text-primary font-semibold md:text-[22px]/[22px] text-[18px]/[18px]">
              {product.price > 0 && <span className="line-through">${product.price?.toFixed(2)}</span>}{" "}${product.priceSale?.toFixed(2)}
            </p>
          </div>
          {!ORDERING_DISABLED && (
            <div className="product_grid_cart_btn md:w-10 w-8 md:h-10 h-8 bg-black rounded-full flex items-center justify-center cursor-pointer" onClick={handleAddToCart}>
              <Icons
                name="add_to_cart"
                width={window.innerWidth >= 768 ? 22 : 15}
                height={window.innerWidth >= 768 ? 22 : 15}
                color="#FFFFFF"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
