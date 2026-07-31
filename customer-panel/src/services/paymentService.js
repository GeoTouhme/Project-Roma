import fetch from "../interceptor/fetchInterceptor"
const PaymentService = {}

PaymentService.paymentIntentCreate = function (orderPayload, idempotencyKey) {
    return fetch({
        url: "/payment-intents",
        method: "post",
        data: {
            ...orderPayload,
            ...(idempotencyKey ? { idempotencyKey } : {}),
        },
    })
}

export default PaymentService;