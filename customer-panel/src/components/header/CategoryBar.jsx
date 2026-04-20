import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

const CategoryBar = ({ categories }) => {
  const location = useLocation();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to show/hide arrows
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [categories, checkScroll]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 250;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Auto-scroll active category into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !categories) return;
    const activeIndex = categories.findIndex(
      (c) =>
        location.pathname === c.link ||
        location.pathname.startsWith(c.link + "/")
    );
    if (activeIndex >= 0) {
      const activeEl = el.children[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [location.pathname, categories]);

  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="container">
        <div className="relative flex items-center">
          {/* Left scroll arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="category-arrow category-arrow-left"
              aria-label="Scroll categories left"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Scrollable category list */}
          <div
            ref={scrollRef}
            className="flex items-center gap-2.5 overflow-x-auto py-3 no-scrollbar scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {categories.map((category, index) => {
              const isActive =
                location.pathname === category.link ||
                location.pathname.startsWith(category.link + "/");
              return (
                <Link
                  key={index}
                  to={category.link}
                  className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {category.title}
                </Link>
              );
            })}
          </div>

          {/* Right scroll arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="category-arrow category-arrow-right"
              aria-label="Scroll categories right"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryBar;
