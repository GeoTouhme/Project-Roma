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

CouponService.verifyByCode = function (code) {
    return fetch({
        url: `/coupon-codes/${code.trim().toUpperCase()}`,
        method: "get",
    });
};

export default CouponService;
