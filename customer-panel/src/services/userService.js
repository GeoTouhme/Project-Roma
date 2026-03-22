import fetch from "../interceptor/fetchInterceptor";

const UserService = {};

UserService.getUser = function () {
  return fetch({
    url: "/users/profile",
    method: "get",
    headers: {
      "public-request": "true",
    },
  });
};

UserService.updateUser = function (data) {
  return fetch({
    url: "/users/profile",
    method: "put",
    headers: {
      "public-request": "true",
    },
    data: data
  });
};

UserService.changePassword = function (data) {
  return fetch({
    url: "/users/change-password",
    method: "put",
    headers: {
      "public-request": "true",
    },
    data: data
  });
};

export default UserService;
