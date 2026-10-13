import * as THREE from "three";

export interface Prop {
  name: string;
  root: THREE.Group;
  mesh: THREE.Mesh;
  /** Rest position, set by the layout. */
  home: THREE.Object3D;
  /** Pose the object eases toward. */
  target: { quaternion: THREE.Quaternion; scale: number };
  highlight(selected: boolean, hovered: boolean): void;
  dispose(): void;
}

const SELECT_COLOR = new THREE.Color("#7cf2c9");
const HOVER_EMISSIVE = new THREE.Color("#3a4a5a");

/** A low-poly rock: a subdivided dodecahedron with every vertex pushed in or out by a stable hash. */
function rockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1.05, 1);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    // Same coordinates give the same displacement, so shared corners stay welded.
    const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453;
    v.multiplyScalar(0.86 + (h - Math.floor(h)) * 0.28);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeProp(name: string, geometry: THREE.BufferGeometry, color: string, metalness: number, roughness: number): Prop {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;

  // Selection outline: the same shape, slightly larger, drawn from the inside.
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: SELECT_COLOR, side: THREE.BackSide, transparent: true, opacity: 0.9 });
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.setScalar(1.06);

  const root = new THREE.Group();
  root.add(mesh, outline);
  return {
    name,
    root,
    mesh,
    home: new THREE.Object3D(),
    target: { quaternion: new THREE.Quaternion(), scale: 1 },
    highlight(selected, hovered) {
      outline.visible = selected;
      material.emissive.copy(hovered ? HOVER_EMISSIVE : new THREE.Color(0x000000));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      outlineMaterial.dispose();
    },
  };
}

export function createProps(): Prop[] {
  return [
    makeProp("Icosahedron", new THREE.IcosahedronGeometry(1.05, 0), "#e8e4dc", 0.05, 0.55),
    makeProp("Torus knot", new THREE.TorusKnotGeometry(0.72, 0.25, 160, 18), "#5f8f9a", 0.6, 0.28),
    makeProp("Rock", rockGeometry(), "#b8a27e", 0.1, 0.8),
  ];
}
