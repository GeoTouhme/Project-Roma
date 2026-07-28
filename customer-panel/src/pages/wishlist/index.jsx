import { useEffect, useState } from "react";
import Breadcrumb from "../../components/breadcrumb";
import WishlistService from "../../services/wishlistService";
import ProductCardSkeleton from "../../components/skeleton/productCardSkeleton";
import ProductCard from "../../components/product-card";
import { useNavigate } from "react-router-dom";

const WishlistPage = () => {
    const navigate = useNavigate()
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);

    const fetchWishlistProducts = () => {
        setProductsLoading(true)
        WishlistService.getWishlist()
            .then((response) => {
                if (response.success && Array.isArray(response.data)) {
                    setProducts(response.data);
                } else {
                    console.error("Invalid wishlist data:", response);
                }
            })
            .catch((error) => {
                console.error("Failed to fetch products:", error);
            }).finally(() => {
                setProductsLoading(false)
            });
    };
    useEffect(() => {
        fetchWishlistProducts();
    }, [])
    return (
        <div className="container md:pb-[100px] pb-[40px]">
            <div className="main">
                <div className="page-title text-center mx-auto py-10">
                    <h2 className="text-[30px] font-bold mb-2">Wishlist</h2>
                    <div className="breadcrumbs">
                        <Breadcrumb />
                    </div>
                </div>
            </div>

            <div className="collection_grid">
                <div className="products_list grid grid-cols-2 md:grid-cols-4 md:gap-5 gap-2">
                    {productsLoading ? <>
                        {<ProductCardSkeleton />}
                    </> : products.length === 0 ? (
                        <div className="w-full col-span-full flex flex-col items-center justify-center border border-primary text-primary bg-primary/10 rounded-xl p-10 text-center">
                            <p className="text-lg font-medium">Your wishlist is empty</p>
                            <p className="text-sm text-gray-600 mt-1">Browse products and add your favorites here.</p>
                            <button onClick={() => navigate("/products")} className={`mt-6 bg-[#B5223B] hover:bg-[#B5223B]/80 transition text-white px-6 py-2 rounded-lg`}>Go To Products</button>
                        </div>
                    ) : products.map((product) => (
                        <ProductCard
                            key={product._id}
                            product={{
                                id: product._id,
                                slug: product.slug,
                                title: product.name,
                                image: product.image?.url,
                                priceSale: product.priceSale,
                                price: product.price,
                                rating: product.averageRating || 0,
                                isWishlisted: true,
                                isBestSeller: product.isBestSeller,
                                isTopCollection: product.isTopCollection,
                            }}
                            wishListDone={() => { fetchWishlistProducts(); }}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default WishlistPage;