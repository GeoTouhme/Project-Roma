import fetch from "../interceptor/fetchInterceptor";

const AuthService = {};

AuthService.login = function (data) {
  return fetch({
    url: "/auth/login",
    method: "post",
    headers: {
      "public-request": "true",
    },
    data: data,
  });
};

AuthService.register = function (data) {
  return fetch({
    url: "/auth/register",
    method: "post",
    headers: {
      "public-request": "true",
    },
    data: data,
  });
};

export default AuthService;
