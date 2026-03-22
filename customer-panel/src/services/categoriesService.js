import fetch from "../interceptor/fetchInterceptor"
const CategoriesService = {}

CategoriesService.allCatgeories = function () {
    return fetch({
        url: "/all-categories",
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

export default CategoriesService;