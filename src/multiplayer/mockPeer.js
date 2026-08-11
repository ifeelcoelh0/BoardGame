const CHANNEL_NAME = "reinos-dragao-e2e-peer-v1";

function randomId(prefix = "mock") {
  const bytes = new Uint8Array(12);
  globalThis.crypto?.getRandomValues?.(bytes);
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("") || Math.random().toString(36).slice(2);
  return `${prefix}-${hex}`;
}

class TinyEmitter {
  constructor() { this.listeners = new Map(); }
  on(type, handler) {
    if (typeof handler !== "function") return this;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return this;
  }
  emit(type, ...args) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(...args);
  }
  removeAllListeners() { this.listeners.clear(); }
}

class MockDataConnection extends TinyEmitter {
  constructor(peer, { connectionId, localId, remoteId, metadata = null }) {
    super();
    this.peerOwner = peer;
    this.connectionId = connectionId;
    this.localId = localId;
    this.peer = remoteId;
    this.metadata = metadata;
    this.open = false;
    this.destroyed = false;
  }

  markOpen() {
    if (this.destroyed || this.open) return;
    this.open = true;
    queueMicrotask(() => this.emit("open"));
  }

  send(payload) {
    if (!this.open || this.destroyed) throw new Error("Ligação mock fechada.");
    this.peerOwner.broadcast({
      kind: "data",
      connectionId: this.connectionId,
      from: this.localId,
      to: this.peer,
      payload,
    });
  }

  receive(payload) {
    if (!this.destroyed) this.emit("data", payload);
  }

  close({ remote = false } = {}) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    this.peerOwner.connections.delete(this.connectionId);
    if (!remote) {
      this.peerOwner.broadcast({
        kind: "close",
        connectionId: this.connectionId,
        from: this.localId,
        to: this.peer,
      });
    }
    queueMicrotask(() => this.emit("close"));
  }
}

export class MockPeer extends TinyEmitter {
  constructor(id = null) {
    super();
    this.id = id || randomId("client");
    this.destroyed = false;
    this.connections = new Map();
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.addEventListener("message", (event) => this.handleMessage(event.data));
    queueMicrotask(() => {
      if (!this.destroyed) this.emit("open", this.id);
    });
  }

  broadcast(message) {
    if (!this.destroyed) this.channel.postMessage(message);
  }

  connect(remoteId, options = {}) {
    if (this.destroyed) throw new Error("Peer mock destruído.");
    const connectionId = randomId("conn");
    const connection = new MockDataConnection(this, {
      connectionId,
      localId: this.id,
      remoteId,
      metadata: options.metadata || null,
    });
    this.connections.set(connectionId, connection);
    this.broadcast({
      kind: "offer",
      connectionId,
      from: this.id,
      to: remoteId,
      metadata: options.metadata || null,
    });
    return connection;
  }

  handleMessage(message) {
    if (this.destroyed || !message || message.to !== this.id) return;
    if (message.kind === "offer") {
      if (this.connections.has(message.connectionId)) return;
      const connection = new MockDataConnection(this, {
        connectionId: message.connectionId,
        localId: this.id,
        remoteId: message.from,
        metadata: message.metadata || null,
      });
      this.connections.set(message.connectionId, connection);
      this.emit("connection", connection);
      this.broadcast({
        kind: "accept",
        connectionId: message.connectionId,
        from: this.id,
        to: message.from,
      });
      queueMicrotask(() => connection.markOpen());
      return;
    }
    const connection = this.connections.get(message.connectionId);
    if (!connection) return;
    if (message.kind === "accept") connection.markOpen();
    else if (message.kind === "data") connection.receive(message.payload);
    else if (message.kind === "close") connection.close({ remote: true });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const connection of [...this.connections.values()]) connection.close();
    this.connections.clear();
    this.channel.close();
    this.removeAllListeners();
  }
}
