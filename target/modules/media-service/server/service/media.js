"use strict";

module.exports = class MediaWorker {
  constructor({ session, media_service, file_io } = {}) { this.session = session; this.media_service = media_service; this.file_io = file_io; }
  context() {
    const input = this.session && this.session.input;
    const auth = input && typeof input.authorization === "function" ? input.authorization() : {};
    const hub = this.session && this.session.hub;
    return { current_hub_id: this.session && typeof this.session.currentHub === "function" ? this.session.currentHub() : hub && (typeof hub.get === "function" ? hub.get("id") : hub.id || hub.hub_id), keysel: auth && auth.keysel };
  }
  async deliver(service, input) {
    const result = await this.media_service.resolve(service, input, this.context());
    const output = this.session && this.session.output;
    if (result.kind === "playlist") return output.write(result.body, result.mimetype);
    return this.file_io.send(output, result.artifact, { name: result.name, mimetype: result.mimetype, disposition: service === "orig" ? "attachment" : "inline" });
  }
  orig(input) { return this.deliver("orig", input); }
  preview(input) { return this.deliver("preview", input); }
  thumb(input) { return this.deliver("thumb", input); }
  document(input) { return this.deliver("document", input); }
  video(input) { return this.deliver("video", input); }
  master(input) { return this.deliver("master", input); }
  stream(input) { return this.deliver("stream", input); }
  segment(input) { return this.deliver("segment", input); }
};
