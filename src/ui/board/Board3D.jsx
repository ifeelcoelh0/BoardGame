import { useEffect, useMemo, useRef } from "react";
import { createBoardScene } from "./boardSceneController.js";
import { stableBoardGeometryKey, stableSpotKey } from "./boardUpdateSignature.js";
import { registerPerformanceProbe } from "../three/performanceProbeRegistry.js";
import "../../styles/resource-flight.css";

export default function Board3D({ g, gr, spotsV, spotsE, spotsH, onVert, onEdge, onHex, graphicsQuality, seat, reducedMotion = false }) {
  const wrapRef = useRef(null);
  const controllerRef = useRef(null);
  const cameraStateRef = useRef(null);
  const sceneIdentityRef = useRef(null);
  const handlersRef = useRef({ onVert, onEdge, onHex });
  handlersRef.current = { onVert, onEdge, onHex };

  const vertexKey = useMemo(() => stableSpotKey(spotsV), [spotsV]);
  const edgeKey = useMemo(() => stableSpotKey(spotsE), [spotsE]);
  const hexKey = useMemo(() => stableSpotKey(spotsH), [spotsH]);
  const boardGeometryKey = stableBoardGeometryKey(g.board);
  const sceneIdentity = `${g.code}:${g.mode}`;

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    if (sceneIdentityRef.current !== sceneIdentity) {
      sceneIdentityRef.current = sceneIdentity;
      cameraStateRef.current = null;
    }
    const controller = createBoardScene(wrapRef.current, gr, g.board, g.players, g.mode, {
      graphicsQuality,
      initialCameraState: cameraStateRef.current,
      localSeat: seat,
      reducedMotion,
    });
    controllerRef.current = controller;
    const unregisterPerformance = registerPerformanceProbe("board", () => controller.getPerformanceSnapshot());
    controller.handlers = {
      onVert: (...args) => handlersRef.current.onVert?.(...args),
      onEdge: (...args) => handlersRef.current.onEdge?.(...args),
      onHex: (...args) => handlersRef.current.onHex?.(...args),
    };
    return () => {
      cameraStateRef.current = controller.getCameraState();
      unregisterPerformance();
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [boardGeometryKey, g.code, g.mode, graphicsQuality, seat, reducedMotion]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.update(g, [...spotsV], [...spotsE], [...spotsH]);
  }, [g.v, vertexKey, edgeKey, hexKey]);

  return <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }} />;
}
