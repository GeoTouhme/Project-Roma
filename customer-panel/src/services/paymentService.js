import fetch from "../interceptor/fetchInterceptor"
const PaymentService = {}

PaymentService.paymentIntentCreate = function (orderPayload) {
    return fetch({
        url: "/payment-intents",
        method: "post",
        data: orderPayload,
    })
}

export default PaymentService;