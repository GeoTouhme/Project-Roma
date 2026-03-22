import fetch from "../interceptor/fetchInterceptor"
const WishlistService = {}

WishlistService.addRemoveWishlist = function (data) {
    return fetch({
        url: "/wishlist",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

WishlistService.getWishlist = function () {
    return fetch({
        url: "/wishlist",
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

export default WishlistService;