import * as THREE from "three";

export function material(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function mesh(geometry, mat, cast = true, receive = true) {
  const object = new THREE.Mesh(geometry, mat);
  object.castShadow = cast;
  object.receiveShadow = receive;
  return object;
}
