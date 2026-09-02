const { Host, Organization, Visitor } = require("./context");
const { KindRegistry } = require("./kind");

function createRuntime({ host, visitor, organization, ...kindOptions } = {}) {
  const Kind = new KindRegistry(kindOptions);
  return {
    Host: new Host(host),
    Kind,
    Organization: new Organization(organization),
    Visitor: new Visitor(visitor),
    render(kind, props) {
      const Widget = Kind.get(kind);
      if (typeof Widget !== "function") throw new Error(`Kind ${kind} is not renderable`);
      return Widget(props || {});
    }
  };
}

module.exports = { createRuntime };
