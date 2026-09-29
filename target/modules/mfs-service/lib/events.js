"use strict";

class MfsEventPublisher {
  constructor({ recipients, project, transport } = {}) {
    this.recipients = recipients || (async ({ principal }) => [principal]);
    this.project = project || (async ({ event }) => event);
    this.transport = transport;
  }

  async publish({ event, principal, filesystem }) {
    if (!this.transport || typeof this.transport.publishRecipient !== "function") return [];
    const recipients = await this.recipients({ event, principal, filesystem });
    const deliveries = [];
    for (const recipient of recipients || []) {
      const payload = await this.project({ event, recipient, principal, filesystem });
      if (!payload) continue;
      deliveries.push(await this.transport.publishRecipient({
        principal: recipient,
        service: "mfs.event",
        payload
      }));
    }
    return deliveries;
  }
}

module.exports = { MfsEventPublisher };
