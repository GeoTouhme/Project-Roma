import React, { useEffect, useState } from "react";
import CouponService from "../../services/couponService";

const PromoBanner = () => {
  const [coupon, setCoupon] = useState(null);

  useEffect(() => {
    CouponService.getActive()
      .then((res) => {
        if (res?.success && res.data?.length) setCoupon(res.data[0]);
      })
      .catch(() => {});
  }, []);

  if (!coupon) return null;

  return (
    <div className="bg-primary text-white text-center py-2 text-sm font-medium">
      Use code <span className="font-bold underline">{coupon.code}</span> for{" "}
      {coupon.type === 'percent' ? `${coupon.discount}% off` : `$${coupon.discount} off`}
    </div>
  );
};

export default PromoBanner;
