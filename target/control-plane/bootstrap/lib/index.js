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
  const domainRows = snapshot.domains.filter((row) => Number(row.id) === DEFAULT_ORG_ID);
  if (!domainRows.length) missing.push("domain:1");
  else if (domainRows.length !== 1 || (domain && domainRows[0].name !== domain)) conflicts.push("organisation 1 has an incompatible domain");
  if (domain && snapshot.domains.some((row) => row.name === domain && Number(row.id) !== DEFAULT_ORG_ID)) {
    conflicts.push("the default organisation domain belongs to another domain id");
  }

  if (!snapshot.organisationTable) missing.push("organisation-table");
  const organisations = snapshot.organisations || [];
  const orgRows = organisations.filter((row) => Number(row.sys_id) === 1 || Number(row.domain_id) === 1);
  if (snapshot.organisationTable && !orgRows.length) missing.push("organisation:1");
  else if (orgRows.length > 1 || (orgRows[0] && (Number(orgRows[0].sys_id) !== 1 || Number(orgRows[0].domain_id) !== 1))) {
    conflicts.push("organisation 1 has conflicting registry rows");
  } else if (orgRows[0] && domain && orgRows[0].link !== domain) {
    conflicts.push("organisation 1 has an incompatible link");
  }
  if (orgRows[0] && !GENERATED_UID.test(orgRows[0].id || "")) conflicts.push("organisation 1 has no generated opaque id");
  if (domain && organisations.some((row) => row.link === domain && Number(row.sys_id) !== 1)) {
    conflicts.push("the default organisation link belongs to another organisation");
  }

  const nobodyCandidates = named(snapshot.principals, "nobody");
  const nobody = snapshot.principals.find((principal) => principal.id === NOBODY_UID);
  const hasNobodyReference = Object.hasOwn(snapshot.configuration, "nobody_id");
  if (!hasNobodyReference) missing.push("sys_conf:nobody_id");
  else if (snapshot.configuration.nobody_id !== NOBODY_UID) conflicts.push("nobody_id does not equal the canonical nobody uid");
  if (!nobody) missing.push("principal:nobody");
  if (nobodyCandidates.some((candidate) => candidate.id !== NOBODY_UID)) conflicts.push("a non-canonical nobody identity exists");
  conflicts.push(...principalProblems(nobody, { id: NOBODY_UID, username: "nobody", privilege: BASIC_PRIVILEGE }));

  const guestCandidates = named(snapshot.principals, "guest");
  const guestId = snapshot.configuration.guest_id;
  const guest = guestId && snapshot.principals.find((principal) => principal.id === guestId);
  const hasGuestReference = Object.hasOwn(snapshot.configuration, "guest_id");
  if (!hasGuestReference) missing.push("sys_conf:guest_id");
  else if (!guestId) conflicts.push("guest_id is empty");
  if (guestId === NOBODY_UID) conflicts.push("guest resolves to nobody");
  if (guestCandidates.length > 1) conflicts.push("multiple guest identities exist");
  if (!guestCandidates.length) missing.push("principal:guest");
  if (guestId && (!guest || guest.username !== "guest")) conflicts.push("guest_id does not resolve to the guest identity");
  if ((guest || guestCandidates[0]) && !GENERATED_UID.test((guest || guestCandidates[0]).id || "")) conflicts.push("guest has no generated Drumee uid");
  conflicts.push(...principalProblems(guest || guestCandidates[0], { username: "guest", privilege: BASIC_PRIVILEGE }));

  const systemCandidates = named(snapshot.principals, "system");
  if (!systemCandidates.length) missing.push("principal:system");
  if (systemCandidates.length > 1) conflicts.push("multiple system identities exist");
  const system = systemCandidates[0];
  if (system && !GENERATED_UID.test(system.id || "")) conflicts.push("system has no generated Drumee uid");
  conflicts.push(...principalProblems(system, { username: "system", privilege: SYSTEM_PRIVILEGE }));
  if (system && (system.id === NOBODY_UID || system.id === guestId)) conflicts.push("system is not distinct from nobody and guest");

  return {
    valid: missing.length === 0 && conflicts.length === 0,
    status: conflicts.length ? "conflicting" : missing.length ? "partial" : "valid",
    missing: [...new Set(missing)],
    conflicts: [...new Set(conflicts)],
    identities: {
      organisation: orgRows[0] && orgRows[0].id || null,
      nobody: nobody && nobody.id || null,
      guest: (guest || guestCandidates[0]) && (guest || guestCandidates[0]).id || null,
      system: system && system.id || null
    }
  };
}

async function validate({ store, database, domain } = {}) {
  const platformStore = store || new SqlPlatformStore({ database });
  return assess(await platformStore.inspect(), { domain });
}

async function bootstrap({ store, database, domain, organisationName = "Drumee" } = {}) {
  if (typeof domain !== "string" || !domain.trim()) {
    throw new PlatformBootstrapError("PLATFORM_DOMAIN_REQUIRED", "Platform bootstrap requires the default organisation domain");
  }
  const platformStore = store || new SqlPlatformStore({ database });
  let snapshot = await platformStore.inspect();
  let report = assess(snapshot, { domain });
  if (report.conflicts.length) {
    throw new PlatformBootstrapError("PLATFORM_BOOTSTRAP_CONFLICT", "Platform state conflicts with the Phase 4.6A contract", report);
  }
  if (report.valid) return { ...report, changed: false };
  await platformStore.installSchema();
  return platformStore.transaction(async () => {
    snapshot = await platformStore.inspect();
    report = assess(snapshot, { domain });
    if (report.conflicts.length) {
      throw new PlatformBootstrapError("PLATFORM_BOOTSTRAP_CONFLICT", "Platform state conflicts with the Phase 4.6A contract", report);
    }

    if (!snapshot.domains.some((row) => Number(row.id) === DEFAULT_ORG_ID)) await platformStore.createDomain(domain);
    if (!snapshot.organisations.some((row) => Number(row.sys_id) === 1 || Number(row.domain_id) === 1)) {
      await platformStore.createOrganisation({ id: await platformStore.generateId(), domain, name: organisationName });
    }
    if (!snapshot.principals.some((principal) => principal.id === NOBODY_UID)) {
      await platformStore.createPrincipal({ id: NOBODY_UID, username: "nobody", domain, privilege: BASIC_PRIVILEGE });
    }
    if (!Object.hasOwn(snapshot.configuration, "nobody_id")) await platformStore.setConfiguration("nobody_id", NOBODY_UID);

    const existingGuest = named(snapshot.principals, "guest")[0];
    let guestId = snapshot.configuration.guest_id || existingGuest && existingGuest.id;
    if (!existingGuest) {
      guestId = await platformStore.generateId();
      await platformStore.createPrincipal({ id: guestId, username: "guest", domain, privilege: BASIC_PRIVILEGE });
    }
    if (!Object.hasOwn(snapshot.configuration, "guest_id")) await platformStore.setConfiguration("guest_id", guestId);

    if (!named(snapshot.principals, "system").length) {
      await platformStore.createPrincipal({ id: await platformStore.generateId(), username: "system", domain, privilege: SYSTEM_PRIVILEGE });
    }

    snapshot = await platformStore.inspect();
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
