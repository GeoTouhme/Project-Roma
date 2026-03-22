import fetch from "../interceptor/fetchInterceptor"
const ProductService = {}

ProductService.allProducts = function (params) {
    return fetch({
        url: "/products",
        method: "get",
        headers: {
            "public-request": "true",
        },
        params: params
    })
}

ProductService.getProductBySlug = function (slug) {
    return fetch({
        url: `/products/${slug}`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

ProductService.getFilters = function () {
    return fetch({
        url: `products/filters`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}
ProductService.getFiltersByCategory = function (category) {
    return fetch({
        url: `filters/${category}`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}
ProductService.getFiltersBySubCategory = function (category, subCategory) {
    return fetch({
        url: `filters/${category}/${subCategory}`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

export default ProductService;