const TEXTURE_KEYS = [
  "map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap",
  "envMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap",
  "specularMap", "gradientMap", "clearcoatMap", "clearcoatNormalMap",
  "clearcoatRoughnessMap", "iridescenceMap", "iridescenceThicknessMap",
  "sheenColorMap", "sheenRoughnessMap", "transmissionMap", "thicknessMap",
];

export function disposeMaterial(material, disposedTextures = new Set()) {
  if (!material) return;
  for (const key of TEXTURE_KEYS) {
    const texture = material[key];
    if (texture?.isTexture && !disposedTextures.has(texture)) {
      disposedTextures.add(texture);
      texture.dispose();
    }
  }
  material.dispose?.();
}

export function disposeObjectTree(root) {
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const disposedTextures = new Set();
  root?.traverse?.((object) => {
    const geometry = object.geometry;
    if (geometry && !disposedGeometries.has(geometry)) {
      disposedGeometries.add(geometry);
      geometry.dispose?.();
    }
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      disposeMaterial(material, disposedTextures);
    }
  });
}
