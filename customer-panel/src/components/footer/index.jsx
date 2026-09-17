import React from "react";
import PaymentImage from "../../assets/images/payment_img.png";
import { Link } from "react-router-dom";
import Icons from "../svg";


const Footer = () => {
  return (
    <div className="footer">
      <div className="footer_bottom bg-black pt-[70px] py-5">
        <div className="container">
          <div className="footer_blocks flex justify-between gap-x-5 gap-y-10 flex-wrap xl:flex-nowrap">
            <div className="footer_about">
              <h2 className="text-white uppercase text-[20px]/[20px] font-medium mb-5">About Our Store</h2>
              <p className="text-white pe-10">Balport Liquors is your premier destination for an exceptional selection of fine wines, craft beers, and top-shelf spirits. Located in the heart of Newport Beach, we are dedicated to providing fast, reliable delivery and an unparalleled premium shopping experience.</p>
              <div className="socials flex items-center gap-3 mt-4">
                <Link to="#" className="flex items-center justify-center w-[32px] h-[32px] bg-white rounded-full">
                  <Icons name="facebook" width={18} height={18} color="#B5223B" />
                </Link>
                <Link to="#" className="flex items-center justify-center w-[32px] h-[32px] bg-white rounded-full">
                  <Icons name="twitter" width={16} height={16} color="#B5223B" />
                </Link>
                <Link to="#" className="flex items-center justify-center w-[32px] h-[32px] bg-white rounded-full">
                  <Icons name="instagram" width={18} height={18} color="#B5223B" />
                </Link>
              </div>
            </div>

            <div className="footer_menu min-w-[190px]">
              <h2 className="text-white uppercase text-[20px]/[20px] font-medium mb-5">Services</h2>
              <div className="footer_menu_links grid gap-3">
                <Link to="/privacy-policy" className="text-white tracking-[0.5px] text-[16px]/[20px] hover:text-primary">Privacy Policy</Link>
                <Link to="#" className="text-white tracking-[0.5px] text-[16px]/[20px] hover:text-primary">FAQs</Link>
                <Link to="/terms-and-conditions" className="text-white tracking-[0.5px] text-[16px]/[20px] hover:text-primary">Terms & Conditions</Link>
              </div>
            </div>
            <div className="footer_menu min-w-[190px]">
              <h2 className="text-white uppercase text-[20px]/[20px] font-medium mb-5">Your Account</h2>
              <div className="footer_menu_links grid gap-3">
                <Link to="#" className="text-white tracking-[0.5px] text-[16px]/[20px] hover:text-primary">My Account</Link>
                <Link to="#" className="text-white tracking-[0.5px] text-[16px]/[20px] hover:text-primary">Track Order</Link>
              </div>
            </div>
            <div className="footer_contact">
              <h2 className="text-white uppercase text-[20px]/[20px] font-medium mb-5">Contact Us</h2>
              <div className="contact_details grid gap-4">
                <p className="flex items-start gap-2.5">
                  <div className="min-w-4">
                    <Icons name="location" width={20} height={20} color="#FFFFFF" />
                  </div>
                  <span className="text-white tracking-[0.5px] text-[16px]/[20px]">4521 West Coast Hwy, Newport Beach, CA 92663، USA</span>
                </p>
                <Link to="tel:(+1) 949-200-9377" className="flex items-start gap-2.5">
                  <div className="min-w-4">
                    <Icons name="telephone" width={20} height={20} color="#FFFFFF" />
                  </div>
                  <span className="text-white tracking-[0.5px] text-[16px]/[20px]">(+1) 949-200-9377</span>
                </Link>
                <Link to="tel:(+1) 949-200-9377" className="flex items-start gap-2.5">
                  <div className="min-w-4">
                    <Icons name="mobile" width={20} height={20} color="#FFFFFF" />
                  </div>
                  <span className="text-white tracking-[0.5px] text-[16px]/[20px]">(+1) 617-751-0412</span>
                </Link>
                <Link to="mailto:balport@gmail.com" className="flex items-start gap-2.5">
                  <div className="min-w-4">
                    <Icons name="email" width={20} height={20} color="#FFFFFF" />
                  </div>
                  <span className="text-white tracking-[0.5px] text-[16px]/[20px]">balportliquorstore@gmail.com</span>
                </Link>
              </div>
            </div>
          </div>
          <div className="footer_copyright flex justify-between items-center pt-5 mt-5
          border-t border-[#9B9B9B]/30 flex-wrap gap-5">
            <p className="text-white text-[16px]/[20px]">Please Drink Responsibly</p>
            <p className="text-white text-[16px]/[20px]"> If you're useing our website you agree to our terms and conditions</p>
            <p className="text-white text-[16px]/[20px]">© 2025. All rights reserved.</p>
            <img src={PaymentImage} alt="Accepted payment methods" className="max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Footer;