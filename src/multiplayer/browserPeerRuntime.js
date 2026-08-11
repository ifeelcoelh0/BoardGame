import { Peer } from "peerjs";
import { createHostPeerRuntime } from "./hostRuntime.js";
import { createClientPeerRuntime } from "./clientRuntime.js";
import { MockPeer } from "./mockPeer.js";

function selectedPeerClass(options = {}) {
  if (options.PeerClass) return options.PeerClass;
  const mockRequested = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("transport") === "mock";
  return mockRequested ? MockPeer : Peer;
}

export function createBrowserHostPeerRuntime(options = {}) {
  return createHostPeerRuntime({ ...options, PeerClass: selectedPeerClass(options) });
}

export function createBrowserClientPeerRuntime(options = {}) {
  return createClientPeerRuntime({ ...options, PeerClass: selectedPeerClass(options) });
}
