"use strict";

const { PlatformBootstrapError } = require("./errors");
const { SqlPlatformStore } = require("./store");

const DEFAULT_ORG_ID = 1;
const NOBODY_UID = "ffffffffffffffff";
const SYSTEM_PRIVILEGE = 63;
const BASIC_PRIVILEGE = 1;
const GENERATED_UID = /^[a-f0-9]{16}$/i;

function named(principals, username) {
  return principals.filter((principal) => principal.username === username && Number(principal.domain_id) === DEFAULT_ORG_ID);
}

function principalProblems(principal, { id, username, privilege }) {
  const problems = [];
  if (!principal) return problems;
  if (id && principal.id !== id) problems.push(`${username} has uid ${principal.id}, expected ${id}`);
  if (principal.ident !== username || principal.username !== username) problems.push(`${username} identity names are inconsistent`);
  if (Number(principal.dom_id) !== DEFAULT_ORG_ID || Number(principal.domain_id) !== DEFAULT_ORG_ID) problems.push(`${username} is not in organisation ${DEFAULT_ORG_ID}`);
  if (principal.type !== "drumate" || principal.area !== "system" || principal.status !== "system") problems.push(`${username} is not a system Drumate`);
  if (Number(principal.privilege) !== privilege || Number(principal.is_authoritative) !== 1) problems.push(`${username} privilege is not authoritative ${privilege}`);
  return problems;
}

function assess(snapshot, { domain } = {}) {
  const missing = [];
  const conflicts = [];
  const domain_rows = snapshot.domains.filter((row) => Number(row.id) === DEFAULT_ORG_ID);
  if (!domain_rows.length) missing.push("domain:1");
  else if (domain_rows.length !== 1 || (domain && domain_rows[0].name !== domain)) conflicts.push("organisation 1 has an incompatible domain");
  if (domain && snapshot.domains.some((row) => row.name === domain && Number(row.id) !== DEFAULT_ORG_ID)) {
    conflicts.push("the default organisation domain belongs to another domain id");
  }

  if (!snapshot.organisation_table) missing.push("organisation-table");
  const organisations = snapshot.organisations || [];
  const org_rows = organisations.filter((row) => Number(row.sys_id) === 1 || Number(row.domain_id) === 1);
  if (snapshot.organisation_table && !org_rows.length) missing.push("organisation:1");
  else if (org_rows.length > 1 || (org_rows[0] && (Number(org_rows[0].sys_id) !== 1 || Number(org_rows[0].domain_id) !== 1))) {
    conflicts.push("organisation 1 has conflicting registry rows");
  } else if (org_rows[0] && domain && org_rows[0].link !== domain) {
    conflicts.push("organisation 1 has an incompatible link");
  }
  if (org_rows[0] && !GENERATED_UID.test(org_rows[0].id || "")) conflicts.push("organisation 1 has no generated opaque id");
  if (domain && organisations.some((row) => row.link === domain && Number(row.sys_id) !== 1)) {
    conflicts.push("the default organisation link belongs to another organisation");
  }

  const nobody_candidates = named(snapshot.principals, "nobody");
  const nobody = snapshot.principals.find((principal) => principal.id === NOBODY_UID);
  const has_nobody_reference = Object.hasOwn(snapshot.configuration, "nobody_id");
  if (!has_nobody_reference) missing.push("sys_conf:nobody_id");
  else if (snapshot.configuration.nobody_id !== NOBODY_UID) conflicts.push("nobody_id does not equal the canonical nobody uid");
  if (!nobody) missing.push("principal:nobody");
  if (nobody_candidates.some((candidate) => candidate.id !== NOBODY_UID)) conflicts.push("a non-canonical nobody identity exists");
  conflicts.push(...principalProblems(nobody, { id: NOBODY_UID, username: "nobody", privilege: BASIC_PRIVILEGE }));

  const guest_candidates = named(snapshot.principals, "guest");
  const guest_id = snapshot.configuration.guest_id;
  const guest = guest_id && snapshot.principals.find((principal) => principal.id === guest_id);
  const has_guest_reference = Object.hasOwn(snapshot.configuration, "guest_id");
  if (!has_guest_reference) missing.push("sys_conf:guest_id");
  else if (!guest_id) conflicts.push("guest_id is empty");
  if (guest_id === NOBODY_UID) conflicts.push("guest resolves to nobody");
  if (guest_candidates.length > 1) conflicts.push("multiple guest identities exist");
  if (!guest_candidates.length) missing.push("principal:guest");
  if (guest_id && (!guest || guest.username !== "guest")) conflicts.push("guest_id does not resolve to the guest identity");
  if ((guest || guest_candidates[0]) && !GENERATED_UID.test((guest || guest_candidates[0]).id || "")) conflicts.push("guest has no generated Drumee uid");
  conflicts.push(...principalProblems(guest || guest_candidates[0], { username: "guest", privilege: BASIC_PRIVILEGE }));

  const system_candidates = named(snapshot.principals, "system");
  if (!system_candidates.length) missing.push("principal:system");
  if (system_candidates.length > 1) conflicts.push("multiple system identities exist");
  const system = system_candidates[0];
  if (system && !GENERATED_UID.test(system.id || "")) conflicts.push("system has no generated Drumee uid");
  conflicts.push(...principalProblems(system, { username: "system", privilege: SYSTEM_PRIVILEGE }));
  if (system && (system.id === NOBODY_UID || system.id === guest_id)) conflicts.push("system is not distinct from nobody and guest");

  return {
    valid: missing.length === 0 && conflicts.length === 0,
    status: conflicts.length ? "conflicting" : missing.length ? "partial" : "valid",
    missing: [...new Set(missing)],
    conflicts: [...new Set(conflicts)],
    identities: {
      organisation: org_rows[0] && org_rows[0].id || null,
      nobody: nobody && nobody.id || null,
      guest: (guest || guest_candidates[0]) && (guest || guest_candidates[0]).id || null,
      system: system && system.id || null
    }
  };
}

async function validate({ store, database, domain } = {}) {
  const platform_store = store || new SqlPlatformStore({ database });
  return assess(await platform_store.inspect(), { domain });
}

async function bootstrap({ store, database, domain, organisation_name = "Drumee" } = {}) {
  if (typeof domain !== "string" || !domain.trim()) {
    throw new PlatformBootstrapError("PLATFORM_DOMAIN_REQUIRED", "Platform bootstrap requires the default organisation domain");
  }
  const platform_store = store || new SqlPlatformStore({ database });
  let snapshot = await platform_store.inspect();
  let report = assess(snapshot, { domain });
  if (report.conflicts.length) {
    throw new PlatformBootstrapError("PLATFORM_BOOTSTRAP_CONFLICT", "Platform state conflicts with the Phase 4.6A contract", report);
  }
  if (report.valid) return { ...report, changed: false };
  await platform_store.installSchema();
  return platform_store.transaction(async () => {
    snapshot = await platform_store.inspect();
    report = assess(snapshot, { domain });
    if (report.conflicts.length) {
      throw new PlatformBootstrapError("PLATFORM_BOOTSTRAP_CONFLICT", "Platform state conflicts with the Phase 4.6A contract", report);
    }

    if (!snapshot.domains.some((row) => Number(row.id) === DEFAULT_ORG_ID)) await platform_store.createDomain(domain);
    if (!snapshot.organisations.some((row) => Number(row.sys_id) === 1 || Number(row.domain_id) === 1)) {
      await platform_store.createOrganisation({ id: await platform_store.generateId(), domain, name: organisation_name });
    }
    if (!snapshot.principals.some((principal) => principal.id === NOBODY_UID)) {
      await platform_store.createPrincipal({ id: NOBODY_UID, username: "nobody", domain, privilege: BASIC_PRIVILEGE });
    }
    if (!Object.hasOwn(snapshot.configuration, "nobody_id")) await platform_store.setConfiguration("nobody_id", NOBODY_UID);

    const existing_guest = named(snapshot.principals, "guest")[0];
    let guest_id = snapshot.configuration.guest_id || existing_guest && existing_guest.id;
    if (!existing_guest) {
      guest_id = await platform_store.generateId();
      await platform_store.createPrincipal({ id: guest_id, username: "guest", domain, privilege: BASIC_PRIVILEGE });
    }
    if (!Object.hasOwn(snapshot.configuration, "guest_id")) await platform_store.setConfiguration("guest_id", guest_id);

    if (!named(snapshot.principals, "system").length) {
      await platform_store.createPrincipal({ id: await platform_store.generateId(), username: "system", domain, privilege: SYSTEM_PRIVILEGE });
    }

    snapshot = await platform_store.inspect();
    report = assess(snapshot, { domain });
    if (!report.valid) {
      throw new PlatformBootstrapError("PLATFORM_BOOTSTRAP_INCOMPLETE", "Platform bootstrap did not produce a valid installation", report);
    }
    return { ...report, changed: true };
  });
}

module.exports = {
  BASIC_PRIVILEGE,
  DEFAULT_ORG_ID,
  NOBODY_UID,
  PlatformBootstrapError,
  SYSTEM_PRIVILEGE,
  SqlPlatformStore,
  assess,
  bootstrap,
  validate
};
