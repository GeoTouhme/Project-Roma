import fetch from "../interceptor/fetchInterceptor"
const PaymentService = {}

PaymentService.paymentIntentCreate = function (data) {
    return fetch({
        url: "/payment-intents",
        method: "post",
        headers: {
            "public-request": "true",
        },
        data: data
    })
}

export default PaymentService;