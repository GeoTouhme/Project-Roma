import fetch from "../interceptor/fetchInterceptor"
const OrderService = {}

OrderService.creteOrder = function (data) {
    return fetch({
        url: "/orders",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

OrderService.getCartSummary = function (data) {
    return fetch({
        url: "/orders/cart-summary",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

OrderService.getDeliveryQuote = function (data) {
    return fetch({
        url: "/orders/delivery-quote",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

OrderService.getOrderById = function (id) {
    return fetch({
        url: `/orders/${id}`,
        method: "get",
        headers: {
            "public-request": "true",
        },
    })
}

OrderService.getAllOrders = function (params) {
    return fetch({
        url: `/users/invoice`,
        method: "get",
        headers: {
            "public-request": "true",
        },
        params: params
    })
}

OrderService.cancelOrder = function (id, reason) {
    return fetch({
        url: `/orders/${id}/cancel`,
        method: "put",
        headers: {
            "public-request": "true",
        },
        data: { reason }
    })
}

export default OrderService;