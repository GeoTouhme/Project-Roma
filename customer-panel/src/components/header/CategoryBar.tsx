import React from "react";
import { Link, useLocation } from "react-router-dom";

const CategoryBar = ({ categories }) => {
    const location = useLocation();

    if (!categories || categories.length === 0) return null;

    return (
        <div className="bg-white border-b border-gray-200">
            <div className="container">
                <div className="flex items-center gap-4 overflow-x-auto py-3 no-scrollbar md:justify-center">
                    {categories.map((category, index) => {
                        const isActive = location.pathname === category.link || location.pathname.startsWith(category.link + '/');
                        return (
                            <Link
                                key={index}
                                to={category.link}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${isActive
                                        ? "bg-primary text-white"
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
