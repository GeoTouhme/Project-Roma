import React, { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/header";
import Footer from "../../components/footer";
import Skeleton from "react-loading-skeleton";
import HeroImage from "../../assets/images/hero-img.jpg";
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

const Home = () => {
  const [loading, setLoading] = useState(false);

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

  const [openIndex, setOpenIndex] = useState(null);
  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };
  const faqs = [
    {
      question: "How do I create an account?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "How can I pay for my purchase?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "Do you ship to the United States?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "Do you ship to the all of Canada?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "Do you offer free shipping?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "What are Remote Locations/Postal Codes?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
    {
      question: "How long will it take my order to get to me?",
      answer:
        "To create an account with Website Name simply start shopping! Once you are ready to checkout, go to 'My Cart' and click on Checkout, you will then see the New Customers: Please Create Your Account option.",
    },
  ];

  return (
    <div className="main">
      <section className="hero">
        <div className="hero-inner relative">
          {loading && <Skeleton height={630} />}
          <img
            src={HeroImage}
            alt="logo"
            className={`w-full md:h-full h-[300px] object-cover ${loading ? "hidden" : "block"}`}
            onLoad={() => setLoading(false)}
          />
          <div className="hero-content absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center max-w-[800px] w-full px-2">
            <h1 className="md:text-[50px]/[60px] text-[32px]/[42px] font-semibold text-white">
              Natural Delicious Wines Of The Highest Quality
            </h1>
            <Link
              to="/shop"
              className="bg-primary mt-6 md:px-10 px-7 md:py-3 py-2 inline-block rounded-lg text-white font-medium text-[18px]"
            >
              Shop Now
            </Link>
          </div>
        </div>
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
            <div className="products_list grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 md:gap-7 gap-2">
              {BestSellerProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="banner md:mb-[100px] mb-[40px]">
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
      </section>
      <section className="popular_products md:mb-[100px] mb-[40px]">
        <div className="container">
          <div className="section_head mb-8 text-center">
            <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-primary font-semibold md:mb-3 mb-2 uppercase">
              Popular Collection
            </h6>
            <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">Popular Products</h2>
          </div>
          <div className="section_content">
            <div className="products_list grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 md:gap-7 gap-2">
              {PopularProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
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
                    className={`grid transition-all duration-300 ease-in-out overflow-hidden border-t ${
                      openIndex === index ? "max-h-40 opacity-100 pt-3 mt-3" : "max-h-0 opacity-0 py-0"
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
      <section className="customers md:mb-[100px] mb-[40px]">
        <div className="testimonial_inner md:px-0 px-2.5">
          <div className="grid md:grid-cols-[0.8fr,1.2fr] grid-cols-1 items-center">
            <div className="testimonial_imgs pt-[100%] w-full h-full relative">
              <img src={Image1} alt="image1" className="w-full object-cover h-full absolute top-0 left-0" />
              <img
                src={Image2}
                alt="image2"
                className="lg:w-[250px] w-[200px] h-auto object-cover absolute hidden md:block lg:border-[15px] border-[10px] border-white top-1/2 -translate-y-1/2 left-[100%] -translate-x-1/2"
              />
            </div>
            <div className="testimonials md:ps-[112px] md:pt-0 pt-5">
              <div className="section_head mb-8 text-center">
                <h6 className="md:text-[20px]/[28px] text-[16px]/[18px] text-primary font-semibold md:mb-3 mb-2 uppercase">
                  Cheers to Happy Customers
                </h6>
                <h2 className="md:text-[45px]/[50px] text-[26px]/[32px] font-semibold text-black">
                  What Our Customers Say
                </h2>
              </div>
              <div className="all_testimonials max-w-[350px] lg:max-w-[500px] w-full mx-auto text-center">
                <Slider {...TestimonialSliderSettings}>
                  {testimonials.map((testimonial) => (
                    <div key={testimonial.id} className="review_block">
                      <p className="review_comment text-[18px]/[28px] text-black tracking-[-0.1px]">
                        "{testimonial.comment}"
                      </p>
                      <div className="review_rating flex items-center my-5 justify-center">
                        <Rating rating={testimonial.rating} />
                      </div>
                      <div className="author_info flex items-center gap-4 justify-center">
                        <img
                          src={testimonial.image}
                          className="w-[60px] h-[60px] object-cover rounded-full"
                          alt={testimonial.author}
                        />
                        <div className="text-start">
                          <p className="text-black font-medium md:text-[18px] text-[16px]">{testimonial.author}</p>
                          <span className="text-[16px]/[26px] text-black">{testimonial.designation}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </Slider>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
