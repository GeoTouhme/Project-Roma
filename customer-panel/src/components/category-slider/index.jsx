import React from "react";
import { Link } from "react-router-dom";
import Slider from "react-slick";
import { getOptimizedImageUrl } from "../../utils/cloudinary";

const NextArrow = ({ onClick }) => (
  <button
    onClick={onClick}
    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all hidden md:flex"
    aria-label="Scroll categories right"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </button>
);

const PrevArrow = ({ onClick }) => (
  <button
    onClick={onClick}
    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:shadow-lg transition-all hidden md:flex"
    aria-label="Scroll categories left"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>
);

const CategorySlider = ({ categories = [] }) => {
  if (!categories.length) return null;

  const settings = {
    dots: false,
    infinite: categories.length > 4,
    speed: 400,
    slidesToShow: 7,
    slidesToScroll: 2,
    autoplay: false,
    arrows: true,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    swipe: true,
    draggable: true,
    responsive: [
      {
        breakpoint: 1280,
        settings: { slidesToShow: 6 },
      },
      {
        breakpoint: 1024,
        settings: { slidesToShow: 5, slidesToScroll: 2 },
      },
      {
        breakpoint: 768,
        settings: { slidesToShow: 4, slidesToScroll: 2, arrows: false },
      },
      {
        breakpoint: 480,
        settings: { slidesToShow: 3, slidesToScroll: 1, arrows: false },
      },
    ],
  };

  const getCategoryImage = (url) => {
    if (!url) return null;
    return getOptimizedImageUrl(url, {
      width: 300,
      height: 300,
      crop: "fill",
      quality: "auto",
    });
  };

  return (
    <section className="category-slider-section bg-white py-5 md:py-8 border-b border-gray-100">
      <div className="container">
        <div className="relative px-1 md:px-4">
          <Slider {...settings} className="category-slider">
            {categories.map((category) => {
              const imageUrl = getCategoryImage(category.cover?.url);
              const label = category.name;
              const link = `/products/${category.slug}`;

              return (
                <div key={category._id || category.slug} className="px-2 md:px-3">
                  <Link
                    to={link}
                    className="group flex flex-col items-center text-center gap-2 md:gap-3"
                  >
                    <div className="relative w-full aspect-square max-w-[120px] rounded-full overflow-hidden bg-gray-100 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300 shadow-sm group-hover:shadow-md">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={label}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          width="120"
                          height="120"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-medium uppercase">
                          {label?.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm md:text-base font-medium text-black group-hover:text-primary transition-colors line-clamp-1">
                      {label}
                    </span>
                  </Link>
                </div>
              );
            })}
          </Slider>
        </div>
      </div>
    </section>
  );
};

export default CategorySlider;
