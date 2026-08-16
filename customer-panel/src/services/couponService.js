import fetch from "../interceptor/fetchInterceptor";

const CouponService = {};

CouponService.getActive = function () {
    return fetch({
        url: "/coupons/active",
        method: "get",
        headers: {
            "public-request": "true",
        },
    });
};

export default CouponService;
