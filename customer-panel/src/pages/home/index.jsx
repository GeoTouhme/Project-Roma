import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Slide1Wine from "../../assets/images/slide-1-wine.jpg";
import Slide2Cocktail from "../../assets/images/slide-2-cocktail.jpg";
import Slide3Beer from "../../assets/images/slide-3-beer.jpg";
import Slide4DeliveryNew from "../../assets/images/slide-4-delivery-new.jpg";
import Slide5Summer from "../../assets/images/slide-5-summer.jpg";

import FixedBg from "../../assets/images/fixed-bg.png";
import Shape1 from "../../assets/images/shape-1.png";
import Shape2 from "../../assets/images/shape-2.png";
import ProductCard from "../../components/product-card";
import Icons from "../../components/svg";
import Slider from "react-slick";
import HomeService from "../../services/homeService";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";

const Home = () => {
  const [bestSellerProducts, setBestSellerProducts] = useState([]);
  const [bestSellerProductsLoading, setBestSellerProductsLoading] = useState(false);
  const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));
  let user_id = ""
  if (isAuthenticated) {
    const userInfo = JSON.parse(localStorage.getItem("user"));
    user_id = userInfo?._id
  }

  const fetchBestSellerProducts = useCallback(() => {
    setBestSellerProductsLoading(true)
    HomeService.bestSellerProducts({ user_id })
      .then((response) => {
        if (response?.success) {
          setBestSellerProducts(response?.data)
        }
      })
      .catch((error) => {
        console.log("bestSellerProducts error = ", error);
      })
      .finally(() => {
        setBestSellerProductsLoading(false)
      })
  }, [user_id])

  useEffect(() => {
    fetchBestSellerProducts();
  }, [fetchBestSellerProducts])

  const NextArrow = ({ onClick }) => {
    return (
      <div className="custom-arrow next" onClick={onClick}>
        <svg width="7" height="15" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0.306641 1.62695L1.32617 0.695312L9.69336 8.5L1.32617 16.3047L0.306641 15.373L7.6543 8.5L0.306641 1.62695Z"
            fill="white"
          />
        </svg>
      </div>
    );
  };

  const PrevArrow = ({ onClick }) => {
    return (
      <div className="custom-arrow prev" onClick={onClick}>
        <svg width="8" height="16" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M9.69336 15.373L8.67383 16.3047L0.306641 8.5L8.67383 0.695312L9.69336 1.62695L2.3457 8.5L9.69336 15.373Z"
            fill="white"
          />
        </svg>
      </div>
    );
  };

  const gallerySliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: true,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          arrows: false,
        },
      },
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        },
      },
    ],
  };


  const heroSliderSettings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: false,
    fade: true
  };

  const [openIndex, setOpenIndex] = useState(null);
  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };
  const faqs = [
    {
      question: "What is Balport Liquors' delivery area?",
      answer:
        "We currently provide local delivery to Newport Beach and surrounding areas including zip codes: 92663, 92646, 92612, 92647, 92661, 92707, and 92648. If your zip code isn't listed, please check back as we expand our service area.",
    },
    {
      question: "Do I need to show ID for my delivery?",
      answer:
        "Yes, absolutely. Since we sell alcoholic beverages, California law requires a valid government-issued photo ID showing you are 21 or older at the time of delivery. Our DoorDash delivery partner (Dasher) will scan your ID to verify your age.",
    },
    {
      question: "How long does delivery usually take?",
      answer:
        "We pride ourselves on speed! Once your order is placed, we typically prepare it within 15 minutes, and a DoorDash driver will deliver it directly to your door. Most deliveries are completed within 30-60 minutes.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit and debit cards through our secure Stripe payment gateway. To ensure the safety of our drivers and prevent fraud, we do not accept cash on delivery (COD).",
    },
    {
      question: "What happens if I'm not home for the delivery?",
      answer:
        "For orders containing alcohol, someone 21+ must be present to receive the order. If no one is available or ID cannot be verified, the driver will return the products to our store. A return fee may apply.",
    },
    {
      question: "Can I track my order in real-time?",
      answer:
        "Yes! Once your order is dispatched, you will receive a tracking link via email/SMS that allows you to see the driver's location and estimated arrival time on a live map.",
    },
    {
      question: "Where is Balport Liquors located?",
      answer:
        "Our physical store is located at 4521 W Coast Hwy, Newport Beach, CA 92663. You can always stop by to browse our full selection of premium spirits, wines, and beers.",
    },
  ];

  return (
    <div className="main">
      <section className="hero">
        <Slider {...heroSliderSettings} className="hero-slider">
          <div className="hero-inner relative">
            <img
              src={Slide1Wine}
              alt="Premium Wine"
              className="w-full md:h-[600px] h-[350px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"></div>
            <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-4">
              <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-widest mb-3">Premium Collection</p>
              <h1 className="md:text-[56px]/[64px] text-[34px]/[44px] font-bold text-white mb-4">
                Natural & Premium Wines
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto">Curated Selection for Every Occasion</p>
              <a
                href="/category/wine"
                className="bg-primary mt-2 md:px-12 px-8 md:py-4 py-3 inline-block rounded-full text-white font-semibold text-[16px] md:text-[18px] shadow-lg hover:bg-opacity-90 hover:scale-105 transition-all"
              >
                Shop Wine
              </a>
            </div>
          </div>

          <div className="hero-inner relative">
            <img
              src={Slide2Cocktail}
              alt="Premium Cocktails"
              className="w-full md:h-[600px] h-[350px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"></div>
            <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-4">
              <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-widest mb-3">Top Shelf Selection</p>
              <h1 className="md:text-[56px]/[64px] text-[34px]/[44px] font-bold text-white mb-4">
                Elevate Your Spirits
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto">Premium Tequila, Vodka & Mixers</p>
              <a
                href="/products"
                className="bg-primary mt-2 md:px-12 px-8 md:py-4 py-3 inline-block rounded-full text-white font-semibold text-[16px] md:text-[18px] shadow-lg hover:bg-opacity-90 hover:scale-105 transition-all"
              >
                Shop Spirits
              </a>
            </div>
          </div>

          <div className="hero-inner relative">
            <img
              src={Slide3Beer}
              alt="Cold Beers"
              className="w-full md:h-[600px] h-[350px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"></div>
            <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-4">
              <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-widest mb-3">Ice Cold Selection</p>
              <h1 className="md:text-[56px]/[64px] text-[34px]/[44px] font-bold text-white mb-4">
                Game Night Ready
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto">Cold Beers & Your Favorite Snacks</p>
              <a
                href="/products"
                className="bg-primary mt-2 md:px-12 px-8 md:py-4 py-3 inline-block rounded-full text-white font-semibold text-[16px] md:text-[18px] shadow-lg hover:bg-opacity-90 hover:scale-105 transition-all"
              >
                Shop Beer
              </a>
            </div>
          </div>

          <div className="hero-inner relative">
            <img
              src={Slide4DeliveryNew}
              alt="Fast Delivery"
              className="w-full md:h-[600px] h-[350px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"></div>
            <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-4">
              <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-widest mb-3">Fast & Reliable</p>
              <h1 className="md:text-[56px]/[64px] text-[34px]/[44px] font-bold text-white mb-4">
                Premium Drinks, Delivered Fast
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto">Your Favorite Liquor at Your Doorstep</p>
              <a
                href="/products"
                className="bg-primary mt-2 md:px-12 px-8 md:py-4 py-3 inline-block rounded-full text-white font-semibold text-[16px] md:text-[18px] shadow-lg hover:bg-opacity-90 hover:scale-105 transition-all"
              >
                Order Now
              </a>
            </div>
          </div>

          <div className="hero-inner relative">
            <img
              src={Slide5Summer}
              alt="Summer Drinks"
              className="w-full md:h-[600px] h-[350px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60"></div>
            <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-4">
              <p className="text-white/80 text-sm md:text-base font-medium uppercase tracking-widest mb-3">Seasonal Picks</p>
              <h1 className="md:text-[56px]/[64px] text-[34px]/[44px] font-bold text-white mb-4">
                Taste the Summer
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto">Ice-Cold Beers & Hard Seltzers</p>
              <a
                href="/products"
                className="bg-primary mt-2 md:px-12 px-8 md:py-4 py-3 inline-block rounded-full text-white font-semibold text-[16px] md:text-[18px] shadow-lg hover:bg-opacity-90 hover:scale-105 transition-all"
              >
                Refresh Now
              </a>
            </div>
          </div>
        </Slider>
      </section>
      <section
        className="fixed-bg md:py-[150px] pt-10 md:mb-[100px] mb-[40px]"
        style={{ backgroundImage: `url(${FixedBg})` }}
      >
        <div className="container">
          <div className="fixed-bg-inner text-center max-w-[600px] mx-auto">
            <div className="section head mb-8">
              <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black mb-3 ">
                Upgrade To The Latest!
              </h2>
              <h6 className="md:text-[24px]/[28px] text-[18px]/[22px] text-primary font-semibold">
                Introducting our first ever own label range of wines.
              </h6>
            </div>
            <p className="text-[18px]/[28px] text-black tracking-[-0.1px]">
              Experience the rich flavors and craftsmanship of our newly launched signature wine collection. Sourced
              from the finest vineyards, each bottle is carefully curated to bring you an unforgettable tasting
              experience. Whether you're a connoisseur or simply enjoy a great glass of wine, our exclusive range is
              designed to elevate every occasion. Indulge in bold aromas, smooth textures, and the perfect balance of
              tradition and innovation. Cheers to something extraordinary!
            </p>
            <Link
              to="/shop"
              className="border-primary border mt-8 md:px-10 px-7 md:py-3 py-2 inline-block rounded-lg text-primary font-medium text-[18px]"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>
      <section className="best_sellers md:mb-[100px] mb-[40px]">
        <div className="container">
          <div className="section_head mb-8 text-center">
            <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-primary font-semibold md:mb-3 mb-2 uppercase">
              Top Picks: Customer Favorites
            </h6>
            <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">
              Explore Our Best Sellers
            </h2>
          </div>
          <div className="section_content">
            <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-7 gap-2">
              {bestSellerProductsLoading ? <ProductCardSkeleton count={8} /> : bestSellerProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={{
                    id: product._id,
                    slug: product.slug,
                    title: product.name,
                    image: product.image?.url,
                    priceSale: product.priceSale,
                    price: product.price,
                    rating: product.averageRating || 0,
                    isWishlisted: product.isWishlisted,
                  }}
                  wishListDone={() => { fetchBestSellerProducts(); }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="banner md:mb-[100px] mb-[40px]">
        <Slider
          dots={true}
          infinite={true}
          speed={800}
          slidesToShow={1}
          slidesToScroll={1}
          autoplay={true}
          autoplaySpeed={5000}
          arrows={false}
          fade={true}
          className="banner-slider"
        >
          {/* ── Slide 1 — Store Gallery ── */}
          <div>
            <div className="banner-inner relative bg-gray-50 py-8 md:py-12">
              <div className="container">
                <div className="section_head mb-6 md:mb-8 text-center">
                  <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">Store Gallery</h2>
                </div>
                <Slider {...gallerySliderSettings} className="gallery-slider px-2 md:px-8">
                  {[
                    '/images/gallery/photo_2026-05-21_19-29-37.jpg',
                    '/images/gallery/photo_2026-05-21_19-29-58.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-06.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-22.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-29.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-43.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-52.jpg',
                    '/images/gallery/photo_2026-05-21_19-30-58.jpg',
                    '/images/gallery/photo_2026-05-21_19-31-05.jpg',
                    '/images/gallery/photo_2026-05-21_19-31-11.jpg',
                    '/images/gallery/photo_2026-05-21_19-31-20.jpg',
                    '/images/gallery/photo_2026-05-21_19-31-25.jpg',
                    '/images/gallery/photo_2026-05-21_19-31-56.jpg',
                    '/images/gallery/photo_2026-05-21_19-32-02.jpg',
                  ].map((src, index) => (
                    <div key={index} className="gallery_item px-2 overflow-hidden rounded-lg">
                      <img
                        src={src}
                        alt={`Store gallery ${index + 1}`}
                        className="w-full h-[160px] md:h-[220px] object-cover hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ))}
                </Slider>
              </div>
            </div>
          </div>
        </Slider>
      </section>
      <section className="popular_products md:mb-[100px] mb-[40px]">
        <div className="container">
          <div className="section_head mb-8 text-center">
            <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">Top Collections</h2>
          </div>
          <div className="section_content">
            <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-7 gap-2">
              {bestSellerProductsLoading ? <ProductCardSkeleton count={8} /> : bestSellerProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={{
                    id: product._id,
                    slug: product.slug,
                    title: product.name,
                    image: product.image?.url,
                    priceSale: product.priceSale,
                    price: product.price,
                    rating: product.averageRating || 0,
                    isWishlisted: product.isWishlisted,
                  }}
                  wishListDone={() => { fetchBestSellerProducts(); }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="faqs md:pb-[100px] pb-[40px] relative">
        <div className="container">
          <div className="section_head mb-8 text-center">
            <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-primary font-semibold md:mb-3 mb-2 uppercase">
              Faqs
            </h6>
            <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="section_content">
            <div className="faqs_list grid md:gap-5 gap-3 max-w-[800px] mx-auto z-[1] relative">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-lg py-3 px-4">
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="flex justify-between items-center w-full text-left text-lg font-medium"
                  >
                    {faq.question}
                    <span
                      className="transition-transform duration-300"
                      style={{ transform: openIndex === index ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      <Icons name="menu_down_arrow" width={12} height={12} color="#000000" />
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out overflow-hidden border-t ${openIndex === index ? "max-h-40 opacity-100 pt-3 mt-3" : "max-h-0 opacity-0 py-0"
                      }`}
                  >
                    <p className="text-grey_text">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <img src={Shape1} alt="shape1" className="hidden lg:block shape1 w-[250px] absolute right-0 bottom-[-20px]" />
        <img src={Shape2} alt="shape1" className="hidden lg:block shape2 w-[300px] absolute left-0 bottom-[-50px]" />
      </section>

    </div>
  );
};

export default Home;
