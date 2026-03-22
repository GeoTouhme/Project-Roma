import React, { useState } from "react";
import Header from "../../components/header";
import Footer from "../../components/footer";
import ProductImage1 from "../../assets/images/product-img-1.png";
import ProductImage2 from "../../assets/images/product-img-2.png";
import ProductImage3 from "../../assets/images/product-img-3.png";
import ProductImage4 from "../../assets/images/product-img-4.png";
import ProductImage5 from "../../assets/images/product-img-5.png";
import ProductImage6 from "../../assets/images/product-img-6.png";
import Slider from "react-slick";
import { Star } from "lucide-react";
import PaymentMethods from "../../assets/images/payment-methods.svg";
import Visa from "../../assets/images/visa.svg";
import MasterCard from "../../assets/images/mastercard.svg";
import { FaPlus, FaMinus } from "react-icons/fa6";
import { BiSolidPencil } from "react-icons/bi";
import { MdOutlineVerified } from "react-icons/md";

const ProductPage = () => {
  const images = [ProductImage1, ProductImage2, ProductImage3, ProductImage4, ProductImage5, ProductImage6];

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

  const reviews = [
    {
      name: "Kushal",
      email: "vhn@nfn.com",
      review: "Bagneux hein mais je ne suis pas un",
      stars: 5,
      date: "01 October 2024",
      image: "https://randomuser.me/api/portraits/men/1.jpg",
    },
    {
      name: "Amanda",
      email: "amanda123@example.com",
      review: "Paris toujours une belle ville",
      stars: 5,
      date: "02 October 2024",
      image: "https://randomuser.me/api/portraits/women/2.jpg",
    },
    {
      name: "Joseph",
      email: "joseph.m@example.com",
      review: "Lyon je suis content ici",
      stars: 5,
      date: "03 October 2024",
      image: "https://randomuser.me/api/portraits/men/3.jpg",
    },
    {
      name: "Sophia",
      email: "sophia_99@domain.com",
      review: "Marseille l'été est merveilleux",
      stars: 5,
      date: "04 October 2024",
      image: "https://randomuser.me/api/portraits/women/4.jpg",
    },
    {
      name: "Liam",
      email: "liam.brown@example.com",
      review: "Nice la plage est superbe",
      stars: 5,
      date: "05 October 2024",
      image: "https://randomuser.me/api/portraits/men/5.jpg",
    },
    {
      name: "Joseph",
      email: "joseph.m@example.com",
      review: "Lyon je suis content ici",
      stars: 5,
      date: "03 October 2024",
      image: "https://randomuser.me/api/portraits/men/3.jpg",
    },
    {
      name: "Sophia",
      email: "sophia_99@domain.com",
      review: "Marseille l'été est merveilleux",
      stars: 5,
      date: "04 October 2024",
      image: "https://randomuser.me/api/portraits/women/4.jpg",
    },
    {
      name: "Liam",
      email: "liam.brown@example.com",
      review: "Nice la plage est superbe",
      stars: 5,
      date: "05 October 2024",
      image: "https://randomuser.me/api/portraits/men/5.jpg",
    },
  ];

  return (
    <div className="main mt-10">
      <div className="single_product_info">
        <div className="container">
          <div className="product_details grid gap-10 md:grid-cols-[40%,60%] grid-cols-1">
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
                <Slider {...mainSettings} afterChange={(index) => setZoomImage(images[index])}>
                  {images.map((img, idx) => (
                    <div key={idx} className="group">
                      <img
                        src={img}
                        alt={`Product ${idx}`}
                        className="w-full h-auto pointer-events-none transition-opacity duration-200 ease-in-out"
                        style={{
                          opacity: zoomStyle.backgroundSize !== "100%" ? 0 : 1, // Hide image on hover
                        }}
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
                        src={img}
                        alt={`Thumbnail ${idx}`}
                        className="w-full cursor-pointer border rounded-md hover:border-gray-700"
                      />
                    </div>
                  ))}
                </Slider>
              </div>
            </div>

            {/* Product Summary Section */}
            <div className="product_summary w-full mx-auto">
              {/* Product Title */}
              <h1 className="text-3xl font-semibold">Johnnie Walker Blue Label Scotch Whisky 1.75L</h1>

              {/* Ratings */}
              <div className="flex items-center mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="text-yellow-500" size={20} fill="currentColor" />
                ))}
                <span className="ml-2 text-gray-600">Reviews (4)</span>
              </div>

              {/* Price */}
              <div className="mt-2 flex items-center space-x-4">
                <span className="text-gray-500 line-through text-lg">$500.0</span>
                <span className="text-[#B5223B] text-2xl font-bold ml-2">$499.0</span>

                {/* Quantity Selector */}
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
              </div>

              {/* Product Details */}
              <div className="mt-4">
                <h3 className="font-semibold">Item Specifics:</h3>
                <div className="mt-3">
                  <p className="mt-2">
                    <strong>Size:</strong> 1.75L
                  </p>
                  <p className="mt-2">
                    <strong>Region:</strong> Scotland
                  </p>
                  <p className="mt-2">
                    <strong>Product type:</strong> Scotch Whisky
                  </p>
                  <p className="mt-2">
                    <strong>Brand:</strong> Johnnie Walker
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-4 flex space-x-4">
                <button className="w-full px-6 py-2 bg-[#B5223B] text-white">Add To Cart</button>
                <button className="w-full px-6 py-2 border border-[#B5223B] text-[#B5223B]">Buy Now</button>
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
          </div>

          <div className="mt-4 mb-24 w-full border border-[#CECECE] rounded-lg">
            {/* Tab Headers */}
            <div className="flex border-b border-[#CECECE]">
              <button
                className={`px-6 py-3 text-center ${
                  activeTab === "description"
                    ? "border-b-2 border-[#B5223B] text-[#B5223B] font-semibold"
                    : "text-gray-600"
                }`}
                onClick={() => setActiveTab("description")}
              >
                Product Description
              </button>
              <button
                className={`px-6 py-3 text-center ${
                  activeTab === "reviews" ? "border-b-2 border-[#B5223B] text-[#B5223B] font-semibold" : "text-gray-600"
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
                    Johnnie Walker Blue Label is an exquisite blend of some of the rarest and most exceptional Scotch
                    whiskies. Crafted using hand-selected barrels from distilleries across Scotland, it delivers a
                    velvety smooth experience with layers of flavor. This premium whisky offers a rich and complex taste
                    with notes of honey, dried fruit, dark chocolate, and smoky undertones.
                  </p>
                  <p className="text-gray-700 mt-2 text-base">
                    The OxBox (A Trane Brand) J4AC3 Air Conditioner offers you flexible and affordable options for your
                    HVAC equipment needs. Oxbox air conditioners have been tested to perform even in the hottest
                    climates, with equipment that’s quiet, dependable, and affordable
                  </p>
                  <h3 className="mt-4 font-semibold">Tasting Notes:</h3>
                  <ul className="list-disc ml-5 mt-2">
                    <li>🥃 Aroma: Rich and multi-layered, with hints of dried fruit, vanilla, and spice.</li>
                    <li>
                      🥃 Palate: Smooth and well-balanced, featuring honey, caramel, dark chocolate, and smoky oak.
                    </li>
                    <li>🥃 Finish: Long and lingering, with a subtle smokiness and deep, luxurious warmth.</li>
                  </ul>
                </div>
              ) : (
                <div className="mx-auto">
                  <div className="grid md:grid-cols-[35%,65%] grid-cols-1 pt-8 gap-6">
                    {/* Left Side - Average Rating */}
                    <div className="border-r md:border-r border-[#CECECE] p-4 shadow-sm md:mr-6">
                      <h2 className="text-base font-semibold text-center">Average Rating</h2>
                      <div className="text-center my-4">
                        <span className="text-5xl font-bold text-[#B5223B]">0</span>
                        <div className="flex justify-center mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="text-gray-300 mx-1" size={20} />
                          ))}
                        </div>
                        <p className="mt-2 text-gray-500 text-sm">(0 reviews)</p>
                      </div>

                      {/* Star Bars */}
                      <div className="mt-4">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{star}</span>
                            <div className="w-full h-1 bg-gray-200 rounded">
                              <div
                                className="h-1 bg-[#007EFC]"
                                style={{ width: star === 5 ? "50%" : star === 4 ? "30%" : "0%" }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">{star === 5 ? 2 : star === 4 ? 1 : 0}</span>
                          </div>
                        ))}
                      </div>

                      {/* Write Review Button */}
                      <div className="w-full mt-4 border-t-2 border-[#CECECE] flex items-center justify-center">
                        <button className="mt-4 px-4 py-2 border border-[#B5223B] text-[#B5223B] font-semibold rounded-md flex items-center h-12">
                          <BiSolidPencil size={20} />
                          <p className="ml-2 text-base font-bold">Write A Review</p>
                        </button>
                      </div>
                    </div>

                    {/* Right Side - Customer Reviews */}
                    <div className="space-y-4">
                      <div className="max-h-[480px] overflow-y-auto pr-2 md:pr-4">
                        {reviews.map((review, index) => (
                          <div
                            key={index}
                            className="flex flex-col md:flex-row justify-between items-start border-b pb-4 w-full"
                          >
                            {/* Left Side: Profile + Review */}
                            <div className="flex items-start space-x-4 w-full">
                              {/* Profile Image */}
                              <img
                                src={review.image}
                                alt={review.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />

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
                                      className={i < review.stars ? "text-yellow-500 mx-1" : "text-gray-300 mx-1"}
                                      size={18}
                                      fill="currentColor"
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Date & Verified Purchase */}
                            <div className="mt-2 md:mt-0 text-sm text-gray-500 flex flex-col items-end">
                              <div className="flex items-center text-[#03A456]">
                                <MdOutlineVerified color="#03A456" size={16} />
                                <span className="ml-1">Verified Purchase</span>
                              </div>
                              <p className="mt-1">{review.date}</p>
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
    </div>
  );
};

export default ProductPage;
