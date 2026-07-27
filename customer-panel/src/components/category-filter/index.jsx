import React, { useMemo, useRef, useState } from "react";
import useCategoryFilter from "../../hooks/useCategoryFilter";
import mapCategories from "../../utils/mapCategories";

/**
 * Count badge shown next to a chip label when count > 0.
 */
function CountBadge({ count }) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-medium leading-none">
      {value}
    </span>
  );
}

/**
 * Two-row animated category chip filter.
 *
 * Row 1: parent categories (+ overflow expander when more than 7).
 * Row 2: subcategories for the selected parent, animated open/closed.
 *
 * @param {Object} props
 * @param {Array} props.categories - Categories with children subcategories.
 * @param {string|null} props.selectedCategory
 * @param {string|null} props.selectedSubCategory
 * @param {(categorySlug: string|null, subCategorySlug: string|null) => void} props.onChange
 */
function CategoryFilter({
  categories,
  selectedCategory,
  selectedSubCategory,
  onChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const parentRowRef = useRef(null);
  const subRowRef = useRef(null);
  const dragState = useRef({ startX: 0, scrollLeft: 0, row: null });

  const selectedParent = useMemo(() => {
    return categories.find((c) => c.slug === selectedCategory) || null;
  }, [categories, selectedCategory]);

  const visibleParents = useMemo(() => {
    if (expanded || categories.length <= 7) return categories;
    return categories.slice(0, 7);
  }, [categories, expanded]);

  const hiddenParentCount = categories.length - 7;

  const handleParentClick = (slug) => {
    if (slug === null) {
      onChange(null, null);
    } else {
      onChange(slug, null);
    }
  };

  const handleSubClick = (slug) => {
    onChange(selectedCategory, slug);
  };

  const handleMouseDown = (e, rowRef) => {
    if (!rowRef.current) return;
    setIsDragging(true);
    dragState.current = {
      startX: e.pageX - rowRef.current.offsetLeft,
      scrollLeft: rowRef.current.scrollLeft,
      row: rowRef.current,
    };
  };

  const handleMouseMove = (e) => {
    const row = dragState.current.row;
    if (!isDragging || !row) return;
    e.preventDefault();
    const x = e.pageX - row.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.5;
    row.scrollLeft = dragState.current.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    dragState.current.row = null;
    setIsDragging(false);
  };

  const chipBaseClasses =
    "inline-flex items-center flex-shrink-0 px-4 py-2 rounded-full border border-border_color bg-cream text-black text-sm font-medium cursor-pointer whitespace-nowrap select-none transition-colors duration-150";

  const activeParentClasses = "bg-primary text-white border-primary";
  const activeSubClasses = "bg-primary/10 text-primary border-primary/20";

  const scrollRowClasses =
    "flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar cursor-grab active:cursor-grabbing";

  return (
    <div className="w-full" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Row 1: Parent categories */}
      <div
        ref={parentRowRef}
        className={`${scrollRowClasses} ${isDragging ? "select-none" : ""}`}
        onMouseDown={(e) => handleMouseDown(e, parentRowRef)}
      >
        <button
          type="button"
          onClick={() => handleParentClick(null)}
          className={`${chipBaseClasses} ${
            selectedCategory === null ? activeParentClasses : "hover:bg-gray-100"
          }`}
          aria-pressed={selectedCategory === null}
        >
          All
          <CountBadge
            count={categories.reduce((sum, c) => sum + (Number(c.productCount) || 0), 0)}
          />
        </button>

        {visibleParents.map((parent) => (
          <button
            key={parent.slug}
            type="button"
            onClick={() => handleParentClick(parent.slug)}
            className={`${chipBaseClasses} ${
              selectedCategory === parent.slug
                ? activeParentClasses
                : "hover:bg-gray-100"
            }`}
            aria-pressed={selectedCategory === parent.slug}
          >
            {parent.name}
            <CountBadge count={parent.productCount} />
          </button>
        ))}

        {!expanded && hiddenParentCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`${chipBaseClasses} border-dashed hover:bg-gray-100`}
            aria-expanded={false}
          >
            + {hiddenParentCount} more ▾
          </button>
        )}
      </div>

      {/* Row 2: Subcategories */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: selectedParent ? "80px" : "0px",
          opacity: selectedParent ? 1 : 0,
          marginTop: selectedParent ? "12px" : "0px",
        }}
        aria-hidden={!selectedParent}
      >
        {selectedParent && (
          <div
            ref={subRowRef}
            className={`${scrollRowClasses} ${isDragging ? "select-none" : ""}`}
            onMouseDown={(e) => handleMouseDown(e, subRowRef)}
          >
            <span className="flex-shrink-0 text-[13px] font-semibold text-grey_text mr-1">
              {selectedParent.name} ›
            </span>

            <button
              type="button"
              onClick={() => handleSubClick(null)}
              className={`${chipBaseClasses} ${
                selectedSubCategory === null
                  ? activeSubClasses
                  : "hover:bg-gray-100"
              }`}
              aria-pressed={selectedSubCategory === null}
            >
              All
              <CountBadge count={selectedParent.productCount} />
            </button>

            {selectedParent.children.map((sub) => (
              <button
                key={sub.slug}
                type="button"
                onClick={() => handleSubClick(sub.slug)}
                className={`${chipBaseClasses} ${
                  selectedSubCategory === sub.slug
                    ? activeSubClasses
                    : "hover:bg-gray-100"
                }`}
                aria-pressed={selectedSubCategory === sub.slug}
              >
                {sub.name}
                <CountBadge count={sub.productCount} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convenience wrapper that wires CategoryFilter to the URL-driven filter hook.
 *
 * @param {Object} props
 * @param {Array} props.categories - Raw categories from the API.
 */
export default function CategoryFilterWrapper({ categories }) {
  const {
    selectedCategory,
    selectedSubCategory,
    setFilter,
  } = useCategoryFilter();

  const mapped = useMemo(() => mapCategories(categories), [categories]);

  return (
    <CategoryFilter
      categories={mapped}
      selectedCategory={selectedCategory}
      selectedSubCategory={selectedSubCategory}
      onChange={setFilter}
    />
  );
}
