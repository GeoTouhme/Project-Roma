import React from "react";
import { Link } from "react-router-dom";

/**
 * Reusable promotional banner components for the homepage.
 *
 * Design rules (see homepage redesign spec):
 *  - Banners embed their own text/prices inside the artwork, so images are
 *    NEVER cropped: aspect-ratio is locked via width/height attributes and
 *    object-contain, with no object-fit: cover anywhere.
 *  - Real <Link> destinations only — no non-functional buttons.
 *  - Lazy-loading for below-the-fold banners; eager only when requested.
 */

/** A single full-composition banner wrapped in a real router link. */
export const BannerLink = ({
  image,
  alt,
  link,
  width,
  height,
  eager = false,
  className = "",
  imgClassName = "",
}) => (
  <Link
    to={link}
    className={`block group overflow-hidden rounded-xl ${className}`}
    aria-label={alt}
  >
    <img
      src={image}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01] ${imgClassName}`}
    />
  </Link>
);

/**
 * Horizontally navigable promo strip (Deals & Offers).
 * Manual prev/next only — no autoplay. Mobile: swipe (native touch scroll
 * inside a snap-x container); desktop: prev/next buttons.
 */
export const PromoStripCarousel = ({ banners = [], ariaLabel = "Promotional banners" }) => {
  if (!banners.length) return null;

  const scrollBy = (direction) => {
    const track = document.getElementById("promo-strip-track");
    if (!track) return;
    const slide = track.querySelector("[data-promo-slide]");
    const amount = slide ? slide.clientWidth : track.clientWidth * 0.9;
    track.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <div className="relative" role="region" aria-label={ariaLabel}>
      <div
        id="promo-strip-track"
        className="promo-strip flex gap-4 md:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
      >
        {banners.map((banner, index) => (
          <div
            key={banner.image}
            data-promo-slide
            className="snap-start shrink-0 w-full md:w-[68%] lg:w-[72%] xl:w-[76%] mx-auto"
          >
            <BannerLink {...banner} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Previous promotional banner"
          className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Next promotional banner"
          className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};