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

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Disclaimer</h2>
          <p>
            Balport Liquors provides this site on an "as is" basis. While we strive for accuracy, we are not responsible for typographical errors in pricing or product descriptions.
          </p>
        </section>

        <div className="text-sm text-gray-500 mt-12 border-t pt-4 text-center">
          Last Updated: March 2026
        </div>
      </div>
    </div>
  );
};

export default Terms;
