# Open Questions

All remain `INVESTIGATE` until code/history/runtime evidence or approval resolves them.

1. What exact yp/schema subset is minimal, especially DMZ, quota, notification and base hub membership? Secure-share policy is specifically unclassified and must not be pulled into the OS merely because it uses the ACL engine.
2. Which process fills/repairs the factory pool in each channel, what are its state transitions, and how are failures reclaimed?
3. Is the physical MFS layout stable or should core expose a storage adapter? Which alternate stores exist?
4. What exact common-template application order exists, and how can module schemas update every current/future entity atomically?
5. Are contacts, sharing, editors, previewers, admin panels and notifications system or Team modules?
6. Which duplicate/deprecated/custom/offline schemas still have consumers? Onboarding-server is confirmed `LEGACY`; no other candidate is classified without evidence.
7. What produces `/etc/drumee/conf.d/plugins/<endpoint>.json`, and does the runtime loader honor Debian `.disabled` markers?
8. What produces UI plugin `index.json`, and how are frontend/backend halves associated and versioned?
9. Why does Loby package metadata reference `analytics-server`?
10. Is `server-essentials::server_plugins_home` intentionally under `plugins/ui`?
11. What package compatibility matrix is supported across the imported versions and consumer ranges?
12. What are authoritative CI/startup/test commands where package test scripts are absent?
13. Is the npm CLI supported on native hosts, inside containers, or remotely? Packaging integration is unproven.
14. What auth/pairing/authorization/audit model should the future API backend use?
15. Should module lifecycle live in npm CLI, `drumee-ctl`, a platform service, or layers of all three?
16. What remove/disable data-retention and migration rollback semantics apply?
17. Which APIs, routes, WebSocket events and SQL result shapes are the supported Team compatibility surface?
18. Which existing installation versions must Docker/native upgrades cover?
19. Which reference patterns are normative? Current recommendation: ACL/service and entry/kind declarations are evidence to normalize; none of the seven repositories is a complete canonical module contract.
20. What final repositories/names follow validated extraction? `transient` must not determine them.
21. Should billing/over-limit behavior remain a Team policy or become a reusable policy module? Either way, it is outside the generic dispatcher/ACL engine.
22. What is the smallest browser-shell contract—boot inputs, readiness events, router responsibilities, application hosting and Window Manager integration—and which current UI Team behaviors must remain outside it?
23. Which legacy onboarding-server versions/schema lineages contain production data, and what migration is required into loby?
24. Are onboarding-server analytics records/services still needed as migration inputs or historical data after the plugin itself is retired?
25. What generates signin's deployed `index.json`, and what exact host/runtime versions and Loby API version does it require?
26. Is sandbox intentionally public in supported deployments, and which quotas/rate limits/cleanup guarantees bound its domain/user/MFS authority?
27. Is marketplace `service/lib/payment.js` reachable through an unimported ACL or external loader, and where are its payment schemas and Stripe dependency declared?
28. Is marketplace's EurOffice secure-share behavior part of the secure-share policy module, the editor module, or an adapter between them?
