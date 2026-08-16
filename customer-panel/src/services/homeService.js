import fetch from "../interceptor/fetchInterceptor"
const HomeService = {}

HomeService.topProducts = function (params) {
    return fetch({
        url: "/home/products/top",
        method: "get",
        headers: {
            "public-request": "true",
        },
        params
    })
}

HomeService.bestSellerProducts = function (params) {
    return fetch({
        url: "/home/products/best-selling",
        method: "get",
        headers: {
            "public-request": "true",
        },
        params
    })
}

HomeService.featuredProducts = function (params) {
    return fetch({
        url: "/home/products/featured",
        method: "get",
        headers: {
            "public-request": "true",
        },
        params
    })
}

HomeService.categories = function () {
    return fetch({
        url: "/home/categories",
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

export default HomeService;