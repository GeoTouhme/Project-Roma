import React, { useCallback, useEffect, useState } from "react";
import Slider from "react-slick";
import { Star } from "lucide-react";
import PaymentMethods from "../../assets/images/payment-methods.svg";
import Visa from "../../assets/images/visa.svg";
import MasterCard from "../../assets/images/mastercard.svg";
import { FaPlus, FaMinus } from "react-icons/fa6";
import { BiSolidPencil } from "react-icons/bi";
import { MdOutlineVerified } from "react-icons/md";
import ProductService from "../../services/productService";
import { getProductDetailImage, getProductThumbImage } from "../../utils/cloudinary";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css"
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ReviewsService from "../../services/reviewsService";
import ReviewModal from "../../components/review-modal";
import RecommendationSection from "../../components/recommendation-section";
import moment from "moment";
import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from "../../config/orderingConfig";
import { trackPageView } from "../../services/analyticsService";

const ProductPage = () => {
  const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  // const images = [ProductImage1, ProductImage2, ProductImage3, ProductImage4, ProductImage5, ProductImage6];
  const [images, setImages] = useState([]);

  const [nav1, setNav1] = useState(null);
  const [nav2, setNav2] = useState(null);
  const [zoomImage, setZoomImage] = useState(images[0]); // Default image for zoom
  const [zoomStyle, setZoomStyle] = useState({
    backgroundSize: "100%",
    backgroundPosition: "center",
  });
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");

  const increaseQuantity = () => setQuantity(quantity + 1);
  const decreaseQuantity = () => quantity > 1 && setQuantity(quantity - 1);

  // Main Slider Settings
  const mainSettings = {
    asNavFor: nav2,
    ref: (slider) => setNav1(slider),
    arrows: false,
    fade: true,
    afterChange: (index) => setZoomImage(images[index]), // Update zoom image on slide change
  };

  // Thumbnail Slider Settings
  const thumbSettings = {
    asNavFor: nav1,
    ref: (slider) => setNav2(slider),
    slidesToShow: 4,
    swipeToSlide: true,
    focusOnSelect: true,
    arrows: false,
    infinite: false,
  };

  // Handle Mouse Move for Zoom Effect
  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      backgroundSize: "200%", // Zoom Level
      backgroundPosition: `${x}% ${y}%`,
    });
  };

  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const fetchReviews = (pid) => {
    ReviewsService.getReviews(pid)
      .then((response) => {
        const { reviews, reviewsSummery } = response;

        setReviews(reviews || []);
        setReviewSummary(reviewsSummery || []);

        // Total Reviews
        const total = reviewsSummery.reduce((sum, r) => sum + r.count, 0);
        setTotalReviews(total);

        // Average Rating
        const avg = reviewsSummery.reduce((acc, r) => acc + r._id * r.count, 0) / (total || 1);
        setAverageRating(Math.round(avg)); // one decimal point
      })
      .catch((error) => {
        console.log("error = ", error);
      })
  }

  const fetchProduct = useCallback((slug) => {
    setLoading(true);
    ProductService.getProductBySlug(slug)
      .then((response) => {
        if (response.success) {
          setProduct(response.data);
          fetchReviews(response.data?._id);

          // Track product view
          trackPageView('product', { slug, name: response.data?.name || '' });
          // setReviews(response.data?.reviews);
          setCategory(response?.category);
          if (response.data.images?.length) {
            const imgs = response.data.images || [];
            setImages(imgs);
            setZoomImage(response.data.images[0].url);
          }
          // setProducts(response.data);
        } else {
          console.error("Invalid product data:", response);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch product:", error);

      })
      .finally(() => {
        setLoading(false); // Stop loading
      });
  }, []);

  useEffect(() => {
    const url = window.location.href;
    const lastSegment = url.substring(url.lastIndexOf('/') + 1);
    fetchProduct(lastSegment);
  }, [fetchProduct]);

  const renderSkeleton = () => (
    <>
      {/* Left - Image Skeleton */}
      <div className="product_media w-full mx-auto">
        <div className="w-full h-[500px] border overflow-hidden">
          <Skeleton height="100%" />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, idx) => (
            <Skeleton key={idx} height={80} />
          ))}
        </div>
      </div>

      {/* Right - Info Skeleton */}
      <div className="product_summary w-full mx-auto">
        <Skeleton height={40} width="60%" />
        <Skeleton height={20} width="40%" className="mt-3" />

        <div className="mt-4 flex space-x-4">
          <Skeleton height={30} width={80} />
          <Skeleton height={30} width={100} />
        </div>

        <div className="mt-6 space-y-2">
          <Skeleton height={20} width="90%" />
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="80%" />
          <Skeleton height={20} width="60%" />
        </div>

        <div className="mt-10 flex space-x-4">
          <Skeleton height={45} width="48%" />
          <Skeleton height={45} width="48%" />
        </div>

        <div className="mt-10">
          <Skeleton height={50} />
          <div className="mt-4 flex space-x-4">
            <Skeleton height={30} width={60} />
            <Skeleton height={30} width={60} />
            <Skeleton height={30} width={60} />
          </div>
        </div>
      </div>
    </>
  );


  const renderNotFound = () => (
    <div className="col-span-2 text-center py-20 bg-[#FFF1F1] rounded-lg shadow-sm ">
      <h2 className="text-2xl font-semibold text-[#B5223B]">Product not found</h2>
      <p className="text-gray-600 mt-2">We couldn’t find the product you’re looking for. Please check the URL or try again later.</p>
    </div>
  );

  const handleAddToCart = () => {
    if (!product) return;

    const cartItem = {
      id: product._id,
      name: product.name,
      brand: product.brand,
      sku: product.sku,
      slug: product.slug,
      price: product.price,
      priceSale: product.priceSale,
      salePrice: product.priceSale,
      image: product.images?.[0]?.url,
      quantity,
    };
    console.log("product = ", product);

    dispatch(addToCart(cartItem));
    toast.success("Added to cart.");
    setQuantity(1)
  };

  const handleBillingNavigate = () => {

    if (!isAuthenticated) {
      navigate("/login");
    } else {
      if (!product) return;

      const cartItem = {
        id: product._id,
        name: product.name,
        brand: product.brand,
        sku: product.sku,
        slug: product.slug,
        price: product.price,
        priceSale: product.priceSale,
        salePrice: product.priceSale,
        image: product.images?.[0]?.url,
        quantity,
      };

      dispatch(addToCart(cartItem));
      toast.success("Added to cart.");
      navigate("/billing");
    }
  };

  return (
    <div className="main mt-10">
      <div className="single_product_info">
        <div className="container">
          <div className="product_details grid gap-10 md:grid-cols-[40%,60%] grid-cols-1">
            {loading ? (
              renderSkeleton()
            ) : product ? (
              <>
                <div className="product_media w-full mx-auto">
                  <div
                    className="relative w-full h-auto border border-[#000000] overflow-hidden bg-center bg-no-repeat"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setZoomStyle({ backgroundSize: "100%", backgroundImage: "none" })}
                    style={{
                      backgroundImage: `url(${zoomImage})`,
                      backgroundSize: zoomStyle.backgroundSize,
                      backgroundPosition: zoomStyle.backgroundPosition,
                      transition: "background-position 0.1s ease",
                    }}
                  >
                    {/* Main Image Slider */}
                    <Slider {...mainSettings} afterChange={(index) => setZoomImage(images[index]?.url)}>
                      {images.map((img, idx) => (
                        <div key={idx}>
                          <img
                            src={getProductDetailImage(img.url)}
                            alt={`Product ${idx}`}
                            className="w-full h-auto pointer-events-none"
                            style={{ opacity: zoomStyle.backgroundSize !== "100%" ? 0 : 1 }}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </Slider>
                  </div>

                  {/* Thumbnail Slider */}
                  <div className="mt-4">
                    <Slider {...thumbSettings}>
                      {images.map((img, idx) => (
                        <div key={idx} className="px-1">
                          <img
                            src={getProductThumbImage(img?.url)}
                            alt={`Thumbnail ${idx}`}
                            className="w-full cursor-pointer border rounded-md hover:border-gray-700"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </Slider>
                  </div>
                </div>


                <div className="product_summary w-full mx-auto">
                  {/* Product Title */}
                  <h1 className="text-3xl font-semibold">{product?.name}</h1>

                  {/* Ratings */}
                  <div className="flex items-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="text-gray-300" size={20} fill="white" />
                    ))}
                    <span className="ml-2 text-gray-600">Reviews ({product?.reviews?.length})</span>
                  </div>

                  {/* Price */}
                  <div className="mt-2 flex items-center space-x-4">
                    <span className="text-gray-500 line-through text-lg">${product?.price}</span>
                    <span className="text-[#B5223B] text-2xl font-bold ml-2">${product?.priceSale}</span>

                    {!ORDERING_DISABLED && (
                      /* Quantity Selector */
                      <div className="flex items-center border border-[#CECECE] rounded-md">
                        <div className="mx-6 my-1">
                          <button onClick={decreaseQuantity} className="py-1 text-[#B5223B] text-sm font-bold">
                            <FaMinus />
                          </button>
                          <span className="mx-4 text-lg text-[#B5223B]">{quantity}</span>
                          <button onClick={increaseQuantity} className="py-1 text-[#B5223B]">
                            <FaPlus />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="mt-4">
                    <div className="mt-3">
                      <p className="mt-2">
                        <strong>Category:</strong> {category?.name}
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="mt-16 flex space-x-4">
                    {ORDERING_DISABLED ? (
                      <a
                        href={DOORDASH_ORDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-6 py-3 bg-[#B5223B] text-white text-center font-semibold rounded hover:bg-red-700 transition inline-block"
                      >
                        Order Now on DoorDash
                      </a>
                    ) : (
                      <>
                        <button className="w-full px-6 py-2 bg-[#B5223B] text-white" onClick={handleAddToCart}>Add To Cart</button>
                        <button className="w-full px-6 py-2 border border-[#B5223B] text-[#B5223B]" onClick={() => handleBillingNavigate()}>Buy Now</button>
                      </>
                    )}
                  </div>

                  <div className="relative mt-10 p-4 border rounded-lg text-center border-[#CECECE]">
                    {/* Guarantee Text */}
                    <p className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-[#F7F5F0] px-3 py-3 h-11 text-sm font-normal text-[#111111] leading-6 flex items-center">
                      Guarantee Safe & Secure Checkout
                    </p>

                    {/* Payment Methods */}
                    <div className="my-9 flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4">
                      <img src={PaymentMethods} alt="Visa" className="h-8" />
                      <img src={Visa} alt="MasterCard" className="h-8" />
                      <img src={MasterCard} alt="American Express" className="h-8" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              renderNotFound()
            )}
          </div>

          {!loading && product && (
            <RecommendationSection
              title="Frequently Bought Together"
              slug={product.slug}
              productId={product._id}
              limit={4}
            />
          )}

          <div className="mt-4 mb-24 w-full border border-[#CECECE] rounded-lg">
            {/* Tab Headers */}
            <div className="flex border-b border-[#CECECE]">
              <button
                className={`px-6 py-3 text-center ${activeTab === "description"
                  ? "border-b-2 border-[#B5223B] text-[#B5223B] font-semibold"
                  : "text-gray-600"
                  }`}
                onClick={() => setActiveTab("description")}
              >
                Product Description
              </button>
              <button
                className={`px-6 py-3 text-center ${activeTab === "reviews" ? "border-b-2 border-[#B5223B] text-[#B5223B] font-semibold" : "text-gray-600"
                  }`}
                onClick={() => setActiveTab("reviews")}
              >
                Reviews
              </button>
            </div>

            {/* Tab Content */}
            <div className="">
              {activeTab === "description" ? (
                <div className="mx-6 my-6">
                  <p className="text-gray-700 mt-2 text-base">
                    {product?.description}
                  </p>
                </div>
              ) : (
                <div className="mx-auto">
                  {/* <div className="grid md:grid-cols-[35%,65%] grid-cols-1 pt-8 gap-6"> */}
                  <div className="flex flex-col md:flex-row pt-8 gap-6">
                    {/* Left Side - Average Rating */}
                    <div className="w-full md:w-1/3 border-r md:border-r border-[#CECECE] p-4 shadow-sm">
                      <h2 className="text-base font-semibold text-center">Average Rating</h2>
                      <div className="text-center my-4">
                        <span className="text-5xl font-bold text-[#B5223B]">{averageRating}</span>
                        <div className="flex justify-center mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={i < Math.round(averageRating) ? "text-yellow-500 mx-1" : "text-gray-300 mx-1"}
                              size={20}
                              fill="currentColor"
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-gray-500 text-sm">({totalReviews} review{totalReviews !== 1 ? "s" : ""})</p>
                      </div>

                      {/* Star Bars */}
                      <div className="mt-4 space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const starData = reviewSummary.find(r => r._id === star);
                          const starCount = starData ? starData.count : 0;
                          const percentage = totalReviews ? (starCount / totalReviews) * 100 : 0;

                          return (
                            <div key={star} className="flex items-center space-x-2">
                              <span className="text-sm font-medium w-4">{star}</span>
                              <div className="w-full h-1 bg-gray-200 rounded">
                                <div
                                  className="h-1 bg-[#007EFC] rounded"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 w-6 text-right">{starCount}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Write Review Button */}
                      <div className="w-full mt-4 border-t-2 border-[#CECECE] flex items-center justify-center">
                        <button onClick={() => {
                          if (isAuthenticated) {
                            setIsReviewModalOpen(true)
                          } else {
                            navigate("/login")
                          }
                        }} className="mt-4 px-4 py-2 border border-[#B5223B] text-[#B5223B] font-semibold rounded-md flex items-center h-12">
                          <BiSolidPencil size={20} />
                          <p className="ml-2 text-base font-bold">Write A Review</p>
                        </button>
                      </div>
                    </div>

                    {/* Right Side - Customer Reviews */}
                    <div className="space-y-4 w-full md:w-2/3">
                      <div className="max-h-[480px] overflow-y-auto pr-2">
                        {reviews.map((review, index) => (
                          <div
                            key={index}
                            className="flex flex-col md:flex-row justify-between items-start pb-4 w-full"
                          >
                            {/* Left Side: Profile + Review */}
                            <div className="flex items-start space-x-4 w-full">
                              {/* Profile Image */}
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
                                {review.user.firstName?.charAt(0)?.toUpperCase() || "?"}
                              </div>

                              {/* Review Content */}
                              <div className="flex-1">
                                <h3 className="font-semibold">{review.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">{review.email}</p>
                                <p className="text-gray-800 mt-1">{review.review}</p>

                                {/* Star Rating */}
                                <div className="flex items-center mt-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={i < review?.rating ? "text-yellow-500 mx-1" : "text-gray-300 mx-1"}
                                      size={18}
                                      fill="currentColor"
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Date & Verified Purchase */}
                            <div className="mt-2 md:mt-0 text-sm text-gray-500 w-full flex justify-end">
                              <div className="flex flex-col items-end">
                                {review?.isPurchased && <div className="flex items-center text-[#03A456]">
                                  <MdOutlineVerified color="#03A456" size={16} />
                                  <span className="ml-1">Verified Purchase</span>
                                </div>}
                                <p>{moment(review?.createdAt).format("DD MMMM YYYY, HH:mm")}</p>
                                {/* <p>18 March 2025</p> */}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => { setIsReviewModalOpen(false) }}
        pid={product?._id} // pass actual product ID dynamically
        fetchReviews={(pid) => fetchReviews(pid)}
      />
    </div >
  );
};

export default ProductPage;
