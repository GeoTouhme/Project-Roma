import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/header";
import Footer from "../../components/footer";
import Skeleton from "react-loading-skeleton";
import { ORDERING_DISABLED, DOORDASH_ORDER_URL } from "../../config/orderingConfig";



import Slide1Wine from "../../assets/images/slide-1-wine.jpg";
import Slide2Cocktail from "../../assets/images/slide-2-cocktail.jpg";
import Slide3Beer from "../../assets/images/slide-3-beer.jpg";
import Slide4DeliveryNew from "../../assets/images/slide-4-delivery-new.jpg";
import Slide4Delivery from "../../assets/images/slide-4-delivery.jpg";
import Slide5Summer from "../../assets/images/slide-5-summer.jpg";

import FixedBg from "../../assets/images/fixed-bg.png";
import ProductImage1 from "../../assets/images/product-img-1.png";
import ProductImage2 from "../../assets/images/product-img-2.png";
import ProductImage3 from "../../assets/images/product-img-3.png";
import ProductImage4 from "../../assets/images/product-img-4.png";
import ProductImage5 from "../../assets/images/product-img-5.png";
import ProductImage6 from "../../assets/images/product-img-6.png";
import ProductImage7 from "../../assets/images/product-img-7.png";
import ProductImage8 from "../../assets/images/product-img-8.png";
import BannerImage from "../../assets/images/banner-img.png";
import Shape1 from "../../assets/images/shape-1.png";
import Shape2 from "../../assets/images/shape-2.png";
import ProductCard from "../../components/product-card";
import Image1 from "../../assets/images/image1.png";
import Image2 from "../../assets/images/image2.png";
import Client1 from "../../assets/images/client1.png";
import Client2 from "../../assets/images/client2.png";
import Client3 from "../../assets/images/client3.png";
import Icons from "../../components/svg";
import Rating from "../../components/rating-star";
import Slider from "react-slick";
import HomeService from "../../services/homeService";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const [topProductsLoading, setTopProductsLoading] = useState(false);
  const [bestSellerProducts, setBestSellerProducts] = useState([]);
  const [bestSellerProductsLoading, setBestSellerProductsLoading] = useState(false);
  const isAuthenticated = JSON.parse(localStorage.getItem("isAuthenticated"));
  let user_id = ""
  if (isAuthenticated) {
    const userInfo = JSON.parse(localStorage.getItem("user"));
    user_id = userInfo?._id
  }

  const fetchTopProducts = () => {
    setTopProductsLoading(true)
    HomeService.topProducts({ user_id })
      .then((response) => {
        if (response?.success) {
          console.log("fetchTopProducts response = ", response);
          setTopProducts(response?.data)
        }
      })
      .catch((error) => {
        console.log("fetchTopProducts error = ", error);
      })
      .finally(() => {
        setTopProductsLoading(false)
      })
  }
  const fetchBestSellerProducts = () => {
    setBestSellerProductsLoading(true)
    HomeService.bestSellerProducts({ user_id })
      .then((response) => {
        if (response?.success) {
          console.log("bestSellerProducts response = ", response);
          setBestSellerProducts(response?.data)
        }
      })
      .catch((error) => {
        console.log("bestSellerProducts error = ", error);
      })
      .finally(() => {
        setBestSellerProductsLoading(false)
      })
  }

  useEffect(() => {
    fetchTopProducts();
    fetchBestSellerProducts();
  }, [])

  const BestSellerProducts = [
    {
      id: 1,
      title: "Elegant Bordeaux Blend Reserve Precious Rose",
      volume: "800 ML",
      price: 49.99,
      image: ProductImage1,
      rating: 4.5,
      isWishlisted: true,
    },
    {
      id: 2,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage2,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 3,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage3,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 4,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage4,
      rating: 3.5,
      isWishlisted: false,
    },
    {
      id: 5,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "600 ML",
      price: 49.99,
      image: ProductImage5,
      rating: 4.5,
      isWishlisted: false,
    },
    {
      id: 6,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage6,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 7,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage7,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 48,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1200 ML",
      price: 49.99,
      image: ProductImage8,
      rating: 4,
      isWishlisted: false,
    },
  ];
  const PopularProducts = [
    {
      id: 1,
      title: "Elegant Bordeaux Blend Reserve Precious Rose",
      volume: "800 ML",
      price: 49.99,
      image: ProductImage1,
      rating: 4.5,
      isWishlisted: true,
    },
    {
      id: 2,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage2,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 3,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage3,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 4,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage4,
      rating: 3.5,
      isWishlisted: false,
    },
    {
      id: 5,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "600 ML",
      price: 49.99,
      image: ProductImage5,
      rating: 4.5,
      isWishlisted: false,
    },
    {
      id: 6,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "500 ML",
      price: 49.99,
      image: ProductImage6,
      rating: 4,
      isWishlisted: false,
    },
    {
      id: 7,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1000 ML",
      price: 49.99,
      image: ProductImage7,
      rating: 5,
      isWishlisted: true,
    },
    {
      id: 48,
      title: "Elegant Bordeaux Blend Reserve",
      volume: "1200 ML",
      price: 49.99,
      image: ProductImage8,
      rating: 4,
      isWishlisted: false,
    },
  ];
  const testimonials = [
    {
      id: 1,
      comment:
        "I've been a customer of this wine shop for years, and I can't recommend it enough! The selection is superb, with everything from everyday favorites to rare gems.",
      rating: 4.5,
      author: "Emily R.",
      designation: "Wine Enthusiast",
      image: Client1,
    },
    {
      id: 2,
      comment:
        "Fantastic service and an incredible variety of wines. The staff is always helpful in finding the perfect bottle.",
      rating: 5,
      author: "Sophia M.",
      designation: "Wine Collector",
      image: Client2,
    },
    {
      id: 3,
      comment: "Love this place! Great prices, unique selections, and the atmosphere is amazing.",
      rating: 4,
      author: "Amelia L.",
      designation: "Sommelier",
      image: Client3,
    },
  ];
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

  const TestimonialSliderSettings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: false,
    autoplaySpeed: 3000,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
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
                href="https://nrsgo.com/balport/department/1/category/33"
                target="_blank"
                rel="noopener noreferrer"
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
                href="https://nrsgo.com/balport/department/1/category/31"
                target="_blank"
                rel="noopener noreferrer"
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
                href="https://nrsgo.com/balport/department/1/category/23"
                target="_blank"
                rel="noopener noreferrer"
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
                href="https://nrsgo.com/balport/"
                target="_blank"
                rel="noopener noreferrer"
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
                href="https://nrsgo.com/balport/department/10"
                target="_blank"
                rel="noopener noreferrer"
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
      {/* best_sellers section hidden when ordering is disabled */}
      {/*
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
                    isWishlisted: product.isWishlisted, // Adjust if you have logic to determine wishlist status
                  }}
                  wishListDone={() => { fetchBestSellerProducts(); fetchTopProducts(); }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      */}
      <section className="store-gallery md:mb-[100px] mb-[40px]">
        <div className="container">
          <div className="section_head mb-8 text-center">
            <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">Store Gallery</h2>
          </div>
          <div className="section_content">
            <div className="gallery_grid grid grid-cols-2 md:grid-cols-4 md:gap-4 gap-2">
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
                <div key={index} className="gallery_item overflow-hidden rounded-lg">
                  <img
                    src={src}
                    alt={`Store gallery ${index + 1}`}
                    className="w-full h-[200px] md:h-[260px] object-cover hover:scale-110 transition-transform duration-500"
                  />
                </div>
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
          {/* ── Slide 1 ── */}
          <div>
            <div className="banner-inner relative">
              <img src={BannerImage} alt="banner" className="w-full md:h-full h-[400px] object-cover object-right" />
              <div
                className="banner-content absolute top-1/2 left-1/2 md:left-auto md:right-[10%] -translate-x-1/2 md:translate-x-0 -translate-y-1/2 text-center
                    max-w-[500px] w-full md:text-center"
              >
                <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-white font-medium md:mb-3 mb-2 uppercase">
                  Limited-Time Offer
                </h6>
                <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] text-white font-semibold mb-3">
                  Exclusive Online Offer: Free Shipping
                </h2>
                <p className="text-[18px]/[28px] text-white tracking-[-0.1px]">
                  Don't miss our Spring Clearance Sale! Enjoy incredible discounts on a wide selection of wines, including
                  popular varietals
                </p>
                <Link
                  to="/shop"
                  className="bg-primary mt-8 md:px-10 px-7 md:py-3 py-2 inline-block rounded-lg text-white font-medium text-[18px]"
                >
                  Shop Now
                </Link>
              </div>
            </div>
          </div>

          {/* ── Slide 2 — Add your next banner here ── */}
          {/* 
          <div>
            <div className="banner-inner relative">
              <img src={YourNewImage} alt="banner" className="w-full md:h-full h-[400px] object-cover object-right" />
              <div className="banner-content absolute top-1/2 left-1/2 md:left-auto md:right-[10%] -translate-x-1/2 md:translate-x-0 -translate-y-1/2 text-center max-w-[500px] w-full md:text-center">
                <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-white font-medium md:mb-3 mb-2 uppercase">
                  Your Subtitle
                </h6>
                <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] text-white font-semibold mb-3">
                  Your Headline
                </h2>
                <p className="text-[18px]/[28px] text-white tracking-[-0.1px]">
                  Your description text here
                </p>
                <Link to="/shop" className="bg-primary mt-8 md:px-10 px-7 md:py-3 py-2 inline-block rounded-lg text-white font-medium text-[18px]">
                  Shop Now
                </Link>
              </div>
            </div>
          </div>
          */}
        </Slider>
      </section>
      {/* popular_products section hidden when ordering is disabled */}
      {/*
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
                  wishListDone={() => { fetchTopProducts(); fetchBestSellerProducts() }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      */}
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
