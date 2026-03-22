import fetch from "../interceptor/fetchInterceptor"
const ReviewsService = {}

ReviewsService.addReview = function (data) {
    return fetch({
        url: "/reviews",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

ReviewsService.getReviews = function (pid) {
    return fetch({
        url: `/reviews/${pid}`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

export default ReviewsService;