# GDPR launch checklist

Internal checklist for Helix Anthropis Institute. The website is configured as a minimal-data site as of 3 September 2026, but the organisation must complete and maintain the operational items below.

## Before public launch

- [ ] Confirm the controller's exact legal name, legal form, registration number and VAT number (where applicable), then add them to `legal.html` and `privacy.html`.
- [ ] Decide whether a data protection officer is legally required. If one is designated, publish the DPO contact details in `privacy.html`.
- [ ] Approve the retention commitments in `privacy.html`: general enquiries up to 24 months after resolution; unsuccessful volunteer applications up to 12 months; newsletter details until withdrawal.
- [ ] Configure mailbox labels/deletion rules and assign a person to carry out those commitments.
- [ ] Use an organisation-managed email service with suitable access controls, multi-factor authentication, account recovery and a GDPR data-processing agreement. Do not share one password between staff.
- [ ] Record the current processors and international-transfer safeguards for website hosting and email. Keep the contracts and current subprocessor lists with the compliance records.
- [ ] Create a simple record of processing activities covering enquiries, volunteers, members, newsletters, events, donors and any staff data actually handled.
- [ ] Give staff a written process for access, correction, deletion, restriction, portability and objection requests. Log the received date, identity check, decision and response; the normal deadline is one month.
- [ ] Create an incident plan. Assess personal-data breaches promptly and notify the CNPD within 72 hours where the GDPR notification threshold is met.
- [ ] Make sure newsletter consent can be demonstrated and every message has a working, promptly honoured unsubscribe route. Do not import or buy mailing lists without a separately documented lawful basis.

## Hard launch gates

- [ ] Do not add analytics, advertising pixels, embedded social feeds, chat widgets, remote fonts or other optional storage/network calls without a fresh privacy audit and prior consent where required.
- [ ] Do not activate live checkout, payments, donations, membership purchases or shipping until the actual providers, purposes, legal bases, retention, consumer terms, taxes and transfers are published and contracts are in place.
- [ ] Increment `NOTICE_VERSION` in `privacy.js` after a material privacy change so visitors see the updated notice.
- [ ] Test the site in a clean browser profile before each release: no optional request may occur before a valid consent choice.

## Ongoing

- [ ] Review this checklist, the data map, retention actions, access permissions and public notice at least annually and whenever a service changes.
- [ ] Remove accounts and access promptly when a volunteer or staff member no longer needs them.
- [ ] Keep evidence of decisions, processor reviews, staff instructions, rights responses, incidents and notice versions.

Official references: [CNPD cookie guidance](https://cnpd.public.lu/fr/dossiers-thematiques/cookies0/cookies/principes-applicables.html), [CNPD guidance for exercising rights](https://cnpd.public.lu/en/particuliers/faire-valoir.html), [CNPD breach information](https://cnpd.public.lu/en/professionnels/obligations/violation-de-donnees.html), and [European Commission overview of individual rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).
