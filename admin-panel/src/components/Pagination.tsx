import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="flex items-center justify-end gap-4">
      {/* Previous Page */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`px-3 py-1 rounded-md border ${
          currentPage <= 1
            ? "text-gray-400 border-gray-200 cursor-not-allowed"
            : "text-primary border-gray-300 hover:bg-gray-100"
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page Info */}
      <span className="text-sm text-muted-foreground">
        Page <span className="font-medium">{currentPage}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </span>

      {/* Next Page */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`px-3 py-1 rounded-md border ${
          currentPage >= totalPages
            ? "text-gray-400 border-gray-200 cursor-not-allowed"
            : "text-primary border-gray-300 hover:bg-gray-100"
        }`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Pagination;
