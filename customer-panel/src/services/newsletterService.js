import fetch from "../interceptor/fetchInterceptor";

const NewsletterService = {};

NewsletterService.subscribe = function (data) {
  return fetch({
    url: "/newsletter",
    method: "post",
    headers: {
      "public-request": "true",
    },
    data: data,
  });
};

export default NewsletterService;
