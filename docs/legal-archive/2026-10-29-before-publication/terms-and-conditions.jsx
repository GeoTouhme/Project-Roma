import React from 'react';

const Terms = () => {
  return (
    <div className="container mx-auto px-4 py-12 text-gray-800 leading-relaxed">
      <h1 className="text-4xl font-bold mb-8 text-center">Terms and Conditions</h1>
      
      <div className="max-w-4xl mx-auto space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Age Requirement</h2>
          <p>
            By using this website, you represent and warrant that you are at least 21 years of age. Balport Liquors strictly complies with all California and Federal laws regarding the sale and delivery of alcoholic beverages. If you are under 21, you are strictly prohibited from using this site or placing any orders.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Delivery and ID Verification</h2>
          <p>
            All deliveries containing alcohol require the presence of a person 21 years of age or older. At the time of delivery, a valid government-issued photo ID must be presented to the delivery driver (Dasher) for age verification. If no valid ID is provided or the recipient is under 21, the delivery will be cancelled and the products will be returned to our store. A return fee may apply.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Ordering and Payment</h2>
          <p>
            All orders placed through BalportLiquors.com must be paid in full at the time of purchase via our secure Stripe payment gateway. We do not accept cash on delivery. Prices and availability are subject to change without notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Restricted Items</h2>
          <p>
            We reserve the right to refuse service or cancel any order at our discretion, especially if we suspect a violation of law or these terms.
          </p>
        </section>

        <section className="bg-gray-50 border-2 border-amber-300/80 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-amber-500 mt-1">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-gray-950 mb-3 tracking-tight">
                WARNING: Prop 65
              </h2>
              <p className="text-gray-800 text-base md:text-lg leading-relaxed font-normal">
                Drinking distilled spirits, beer, coolers, wine and other alcoholic beverages may increase cancer risk, and, during pregnancy, can cause birth defects. For more information please visit{" "}
                <a
                  href="https://www.p65Warnings.ca.gov/alcohol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-semibold break-all"
                >
                  www.p65Warnings.ca.gov/alcohol
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Disclaimer</h2>
          <p>
            Balport Liquors provides this site on an "as is" basis. While we strive for accuracy, we are not responsible for typographical errors in pricing or product descriptions.
          </p>
        </section>

        <div className="text-sm text-gray-500 mt-12 border-t pt-4 text-center">
          Last Updated: September 2026
        </div>
      </div>
    </div>
  );
};

export default Terms;
