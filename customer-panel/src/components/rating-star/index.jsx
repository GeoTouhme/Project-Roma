import React from "react";

const Rating = ({ rating }) => {
  const totalStars = 5;

  return (
    <div className="flex gap-0.5">
      {[...Array(totalStars)].map((_, index) => {
        const isFull = rating >= index + 1;
        const isHalf = rating > index && rating < index + 1;

        return (
          <svg
            key={index}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Empty Star (Border Only) */}
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.26 5.82 22 7 14.14 2 9.27l6.91-1.01z"
              fill="none"
              stroke="#FFAB00" /* Border color */
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Filled Star (Full or Partial) */}
            {isFull && (
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.26 5.82 22 7 14.14 2 9.27l6.91-1.01z"
                fill="#FFAB00"
              />
            )}

            {/* Half-Star Gradient */}
            {isHalf && (
              <>
                <defs>
                  <linearGradient id={`half-fill-${index}`}>
                    <stop offset="50%" stopColor="#FFAB00" />
                    <stop offset="50%" stopColor="white" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.26 5.82 22 7 14.14 2 9.27l6.91-1.01z"
                  fill={`url(#half-fill-${index})`}
                />
              </>
            )}
          </svg>
        );
      })}
    </div>
  );
};

export default Rating;
