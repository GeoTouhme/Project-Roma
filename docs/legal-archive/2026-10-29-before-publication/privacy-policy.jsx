import React from 'react';

const Privacy = () => {
  return (
    <div className="container mx-auto px-4 py-12 text-gray-800 leading-relaxed">
      <h1 className="text-4xl font-bold mb-8 text-center">Privacy Policy</h1>
      
      <div className="max-w-4xl mx-auto space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p>
            When you place an order at Balport Liquors, we collect personal information such as your name, email address, phone number, and delivery address. This information is necessary to process your transaction and fulfill your delivery.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Payment Security</h2>
          <p>
            Your payment information is processed securely through Stripe. Balport Liquors does not store your credit card details on our servers. Stripe is a leading PCI-compliant payment provider.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Data Sharing with DoorDash</h2>
          <p>
            To fulfill your delivery, your name, address, and phone number are shared with DoorDash. For orders containing alcohol, your information is used by DoorDash to perform age and identity verification as required by California law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. California Privacy Rights (CCPA)</h2>
          <p>
            As a California resident, you have the right to request access to the personal data we collect and to ask for its deletion. We do not sell your personal data to third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
          <p>
            We use cookies to improve your shopping experience, such as remembering items in your cart. You can disable cookies through your browser settings, though this may limit site functionality.
          </p>
        </section>

        <div className="text-sm text-gray-500 mt-12 border-t pt-4 text-center">
          Last Updated: March 2026
        </div>
      </div>
    </div>
  );
};

export default Privacy;
