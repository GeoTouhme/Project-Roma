import React from 'react';

const Accessibility = () => {
  return (
    <div className="container mx-auto px-4 py-12 text-gray-800 leading-relaxed">
      <h1 className="text-4xl font-bold mb-8 text-center">Accessibility</h1>

      <div className="max-w-4xl mx-auto space-y-8">
        <section>
          <p>
            We are making a constant and active effort to enhance accessibility of our website and mobile apps for people with disabilities. If you have any questions or comments regarding accessibility of our site or apps, please contact us at <a href="mailto:balportliquorstore@gmail.com" className="text-primary hover:underline">balportliquorstore@gmail.com</a>.
          </p>
        </section>

        <section>
          <p>
            We want to be as responsive as possible, so in your email message, please indicate the nature of the accessibility issue(s), any specific page(s) you may be encountering difficulty with, and your contact information. Please note: our website and apps may contain links to properties owned and/or operated by third parties, so while we make a sincere effort to make those parts accessible as well, we are not responsible for the accessibility of those other properties. In urgent cases, in order to be as helpful as we can, please feel free to contact us at <a href="tel:+19492009377" className="text-primary hover:underline">949-200-9377</a> and we will make our best effort to help.
          </p>
        </section>

        <div className="text-sm text-gray-500 mt-12 border-t pt-4 text-center">
          Last Updated: October 2026
        </div>
      </div>
    </div>
  );
};

export default Accessibility;