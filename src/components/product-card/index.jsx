import React from "react";
import { Link } from "react-router-dom";
import Rating from "../rating-star";
import Icons from "../svg";

const ProductCard = ({ product }) => {
  return (
    <div 
      key={product.id} 
      className="product_item bg-white py-5 px-3 rounded-lg border border-transparent 
      hover:shadow-md transition duration-300 hover:border-primary"
    >
      <div className="product_grid_image relative pt-[125%]">
        <Link to="/product/1">
          <img 
            src={product.image} 
            alt={product.title} 
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        </Link>
      </div>

      <div className="product_info">
        {/* Rating & Wishlist */}
        <div className="rating_wishlist flex items-center justify-between mb-2">
          <div className="product_grid_rating">
            {product.rating && <Rating rating={product.rating} />}
          </div>
          <div className="product_grid_wishlist">
            <Icons 
              name={product.isWishlisted ? "fill_wishlist" : "wishlist"} 
              width={20} 
              height={20} 
              color="#B5223B" 
            />
          </div>
        </div>

        {/* Title & Volume */}
        <div className="product_grid_title">
          <Link to="/product/1">
            <h6 className="text-black font-medium md:text-[18px] text-[16px]">{product.title}</h6>
            <p className="text-grey_text font-medium text-[14px]">{product.volume}</p>
          </Link>
        </div>

        {/* Price & Add to Cart */}
        <div className="product_price_cart flex items-end justify-between">
          <div className="product_grid_price">
            <p className="text-primary font-semibold md:text-[22px]/[22px] text-[18px]/[18px]">
              ${product.price.toFixed(2)}
            </p>
          </div>
          <div className="product_grid_cart_btn md:w-10 w-8 md:h-10 h-8 bg-black rounded-full flex items-center justify-center">
          <Icons
    name="add_to_cart"
    width={window.innerWidth >= 768 ? 22 : 15} 
    height={window.innerWidth >= 768 ? 22 : 15} 
    color="#FFFFFF"
  />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
