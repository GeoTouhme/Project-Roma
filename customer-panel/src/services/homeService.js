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

export default HomeService;