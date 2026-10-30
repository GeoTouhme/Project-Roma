# Balport Liquors policy drafts — October 29, 2026

Publication update: the user subsequently authorized publication. Clean public versions and deployment evidence are in `docs/legal-published/2026-10-29/`. The files here preserve the original internal drafts and their unresolved review notes.

Status: INTERNAL DRAFTS. Not approved, not published, and not an assertion of legal compliance. These documents describe the remediation release and distinguish proposed terms from facts still requiring confirmation. The existing public legal pages are unchanged by drafting these files.

Read the drafts with `docs/BALPORT_LEGAL_TECHNICAL_AUDIT_2026-10-29.md` and `docs/P1_P2_REMEDIATION_2026-10-29.md`. Remove editorial brackets only after the responsible person supplies and approves the facts. Set an actual effective date when publishing; the preparation date is not an effective date.

## Decisions needed before publication

1. Registered entity/DBA, merchant of record, licenses and authoritative address/contact. Displayed contacts used here: Balport Liquors, 4521 West Coast Hwy, Newport Beach, CA 92663; 949-200-9377; balportliquorstore@gmail.com. These are existing application values, not independently verified business records.
2. Restricted-product permissions, permitted sale/handoff hours, actual ID/recipient checks and staff procedures. Tobacco/nicotine checkout remains blocked by default. Live checkout requires separate approval.
3. Actual delivery vendors/manual sharing, account agreements and data practices, including Google sign-in, email, Cloudinary, hosting/CDN, payment and support vendors. Review sale/sharing classifications and applicability of California privacy requirements. Do not publish a blanket “we never sell/share” statement without this review.
4. Retention periods by record category; legal holds; identity verification and authorized-agent procedures; privacy request owner; vendor deletion, backup expiration and restore procedures. Website request submission is not completed erasure.
5. Remedies for delivery refusal, failed ID checks, missing recipients, returned/damaged goods, partial refunds, delivery/return fees, pickup deadlines and cancellation after acceptance. No new fees or automatic delivery-exception refunds are enabled by this release.
6. Final tax/markup/CRV descriptions, contract-acceptance point, substitutions and promotion rules. Do not describe the existing combined markup as a verified statutory deposit or tax.
7. Accessibility contact ownership and operational accommodation process; counsel review of all policies and warning wording/placement. No arbitration, mandatory class waiver, blanket disclaimer or liability cap is proposed without a specific decision.

## Files

- `privacy-policy.md`
- `terms-and-conditions.md`
- `accessibility-statement.md`
- `delivery-refund-cancellation-policy.md`

## Publication procedure

Approve the completed drafts and business procedures first. Then replace the corresponding website content together, add the delivery/refund route and footer/checkout links, update both policy-version manifests, run `node scripts/verify-shared-config.cjs`, and rebuild/deploy the matching frontend/backend. Preserve a dated copy of each approved version and its review owner. Current document hashes identify the existing public Terms and Privacy text, not these unapproved drafts.

## Primary review references

- [California DOJ: CCPA overview and consumer rights](https://oag.ca.gov/privacy/ccpa).
- [California Privacy Protection Agency: statute effective January 1, 2026](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf).
- [California ABC: delivery of alcoholic beverages](https://www.abc.ca.gov/delivery-of-alcoholic-beverages/).
- [U.S. DOJ: web accessibility guidance](https://www.ada.gov/resources/web-guidance/).
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/).

These references inform review; they do not establish which obligations apply to this business or certify the application.
