import Skeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"

const ProductCardSkeleton = ({ count }) => {

    return (
        [...Array(count || 6)].map((_, index) => (
            <div key={index} className="product_item bg-gray-200 py-5 px-3 rounded-lg border border-transparent">
                <div className="product_grid_image relative pt-[100%] flex items-center justify-center">
                    <Skeleton height="75%" width="75%" className="object-cover rounded-md" />
                </div>

                <div className="product_info">
                    <div className="rating_wishlist flex items-center justify-between mb-2">
                        <div className="product_grid_rating">
                            <Skeleton width={60} height={20} />
                        </div>
                        <div className="product_grid_wishlist">
                            <Skeleton circle width={20} height={20} />
                        </div>
                    </div>

                    <div className="product_grid_title">
                        <Skeleton width="60%" height={20} />
                    </div>

                    <div className="product_price_cart flex items-end justify-between">
                        <div className="product_grid_price">
                            <Skeleton width="40%" height={20} />
                        </div>
                    </div>
                </div>
            </div>
        ))
    )
}

export default ProductCardSkeleton