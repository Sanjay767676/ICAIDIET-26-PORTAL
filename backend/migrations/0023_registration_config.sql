-- Registration fees, early-bird cutoff and bank details become admin-editable.
--
-- Stored as one JSON document in the existing key/value `settings` table so the
-- whole configuration is written in a single atomic upsert. `POST
-- /api/admin/settings` accepts it and `GET /api/settings` returns it parsed, so
-- the admin and user portals read the same source of truth.
--
-- The backend also carries an identical DEFAULT_REGISTRATION_CONFIG, which is
-- used when this key is absent (fresh/local D1) or unparseable, so the user
-- portal never renders an empty fee card.
--
-- `early_bird_until` is an INCLUSIVE calendar date (YYYY-MM-DD) on which early
-- bird pricing still applies. Today that is 23 Oct, with standard fees from
-- 24 Oct -- previously hardcoded as `new Date(year, 9, 24)` in the user portal.
--
-- Fee amounts are free-text display strings so an admin can enter exactly what
-- authors should see, e.g. '₹2,000' or '$350'.
INSERT INTO settings (key, value) VALUES ('registration_config', '{"early_bird_until":"2026-10-23","fees":{"Indian Author":{"Conference alone":{"early":"₹2,000","standard":"₹2,500"},"Conference with Scopus proceedings":{"early":"₹10,000","standard":"₹11,000"}},"Foreign Author":{"Conference alone":{"early":"$350","standard":"$400"},"Conference with Scopus proceedings":{"early":"$400","standard":"$500"}},"Industry Delegate/Research Scholar":{"Conference alone":{"early":"₹2,500","standard":"₹3,000"},"Conference with Scopus proceedings":{"early":"₹12,000","standard":"₹13,000"}}},"bank":{"account_number":"5904946502","ifsc":"CBIN0281361","branch":"Crosscut Road, CBE","beneficiary":"SNSCT CH4 CS","bank_name":"CENTRAL BANK OF INDIA"}}')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
