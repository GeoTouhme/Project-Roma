import fetch from "../interceptor/fetchInterceptor"
const SearchService = {}

SearchService.getSuggestions = function (query) {
    return fetch({
        url: "/search",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: { query }
    })
}

export default SearchService;
