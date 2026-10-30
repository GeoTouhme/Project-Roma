import React from "react";

export default function Accessibility() {
  return (
    <article className="container mx-auto px-4 py-10 md:py-12 text-gray-900 leading-relaxed">
      <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">Accessibility Statement</h1>
      <p className="mb-4">Last updated: October 29, 2026</p>
      <p className="mb-4">Balport Liquors aims to make its website usable by people with disabilities. We are working toward the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA as a technical target. We have not completed a comprehensive conformance evaluation and do not claim that every page or third-party component fully conforms.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-3">Help using the website</h2>
      <p className="mb-4">If you have difficulty browsing products, accessing legal information, managing your account or using checkout, contact us:</p>
      <ul className="list-disc pl-6 mb-4 space-y-2"><li>Phone: 949-200-9377.</li><li>Email: balportliquorstore@gmail.com.</li><li>Store: 4521 West Coast Hwy, Newport Beach, CA 92663.</li></ul>
      <p className="mb-4">Please tell us the page or feature involved, what you were trying to do and the type of assistance you need. You may include your browser or assistive technology if useful, but do not send passwords, full payment-card details or identification documents. You do not need to disclose a diagnosis to describe an access problem.</p>
      <p className="mb-4">We will review reported barriers and discuss an appropriate way to help. Assistance remains subject to applicable product availability, age/ID requirements and lawful fulfillment restrictions.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-3">Accessibility features</h2>
      <p className="mb-4">Website accessibility features include a keyboard-managed age-confirmation dialog, access to legal/privacy pages before age confirmation, a main-content landmark and skip link, visible focus styles, labeled checkout fields and associated errors, keyboard-accessible privacy choices, improved account/review controls and reduced-motion styling.</p>
      <p className="mb-4">We have tested selected features through automated tests and controlled browser checks. They do not establish complete compatibility with every screen reader, browser, device or third-party checkout/sign-in component.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-3">Ongoing work and limitations</h2>
      <p className="mb-4">We continue to review the complete purchase flow, zoom/reflow, contrast, screen-reader behavior, dynamic updates and embedded payment/sign-in components. Third-party tools and externally linked sites may have separate limitations. A third-party dependency is not a reason to ignore a reported barrier; contact us so we can investigate and discuss alternatives.</p>
      <h2 className="text-2xl font-semibold mt-8 mb-3">Feedback and updates</h2>
      <p className="mb-4">We use feedback to prioritize improvements and will update this statement as verified capabilities and limitations change. This statement describes our approach and available contact process; it is not a certification of legal compliance.</p>
      </div>
    </article>
  );
}
