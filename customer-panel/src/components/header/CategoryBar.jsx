import React from "react";
import { Link, useLocation } from "react-router-dom";

const CategoryBar = ({ categories }) => {
  const location = useLocation();

  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="container">
        <div className="flex items-center gap-3 overflow-x-auto py-3 no-scrollbar md:justify-center category-scroll relative">
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
      </div>
    </div>
  );
};

export default CategoryBar;
