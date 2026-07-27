import React, { useMemo, useState } from "react";

interface SubCategory {
  _id: string;
  name: string;
  slug: string;
  productCount?: number;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  productCount?: number;
  children?: SubCategory[];
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onChange: (categorySlug: string | null) => void;
}

function CountBadge({ count }: { count?: number }) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-medium leading-none">
      {value}
    </span>
  );
}

/**
 * Single-row category chip filter for admin pages.
 *
 * @param categories - Categories to display.
 * @param selectedCategory - Currently selected category slug, or null for "All".
 * @param onChange - Called when a category chip is clicked.
 */
export default function CategoryFilter({
  categories,
  selectedCategory,
  onChange,
}: CategoryFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleCategories = useMemo(() => {
    if (expanded || categories.length <= 7) return categories;
    return categories.slice(0, 7);
  }, [categories, expanded]);

  const hiddenCount = categories.length - 7;

  const totalCount = useMemo(() => {
    return categories.reduce((sum, c) => sum + (Number(c.productCount) || 0), 0);
  }, [categories]);

  const chipBaseClasses =
    "inline-flex items-center flex-shrink-0 px-3.5 py-1.5 rounded-full border text-sm font-medium cursor-pointer whitespace-nowrap select-none transition-colors duration-150";

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`${chipBaseClasses} ${
          selectedCategory === null
            ? "bg-primary text-white border-primary"
            : "bg-muted text-foreground border-border hover:bg-accent"
        }`}
        aria-pressed={selectedCategory === null}
      >
        All
        <CountBadge count={totalCount} />
      </button>

      {visibleCategories.map((category) => (
        <button
          key={category.slug}
          type="button"
          onClick={() => onChange(category.slug)}
          className={`${chipBaseClasses} ${
            selectedCategory === category.slug
              ? "bg-primary text-white border-primary"
              : "bg-muted text-foreground border-border hover:bg-accent"
          }`}
          aria-pressed={selectedCategory === category.slug}
        >
          {category.name}
          <CountBadge count={category.productCount} />
        </button>
      ))}

      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${chipBaseClasses} border-dashed hover:bg-accent`}
          aria-expanded={false}
        >
          + {hiddenCount} more ▾
        </button>
      )}
    </div>
  );
}
