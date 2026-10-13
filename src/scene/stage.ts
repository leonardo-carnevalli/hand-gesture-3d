import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Action } from "@/gesture/actions";
import { createProps, type Prop } from "./props";

export type Quality = "high" | "low";

export interface StageSnapshot {
  selected: string;
  hovered: string | null;
  /** Euler angles of the selected object, degrees. */
  rotation: { x: number; y: number; z: number };
  scale: number;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
/** How quickly objects catch up with their target pose, per second. Higher is snappier. */
const FOLLOW_RATE = 12;

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * The 3D side: a few objects, lights and a camera, driven only through `apply(actions)`.
 * Gestures never touch transforms directly; they move a target and the render loop eases toward it.
 */
export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private readonly key = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly props: Prop[];
  private readonly raycaster = new THREE.Raycaster();
  private selected: Prop;
  private hovered: Prop | null = null;
  private elapsed = 0;
  private quality: Quality = "high";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.55;

    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1712, 0.6));
    this.key.position.set(4, 7, 5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.left = -7;
    this.key.shadow.camera.right = 7;
    this.key.shadow.camera.top = 7;
    this.key.shadow.camera.bottom = -7;
    this.key.shadow.radius = 6;
    this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0x8fd8ff, 1.4);
    rim.position.set(-6, 3, -4);
    this.scene.add(rim);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.7;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.props = createProps();
    for (const prop of this.props) this.scene.add(prop.root);
    this.selected = this.props[0];
    this.refreshHighlights();
    this.setQuality("high");
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    this.renderer.setPixelRatio(quality === "high" ? Math.min(dpr, 2) : Math.min(dpr, 1) * 0.75);
    this.renderer.shadowMap.enabled = quality === "high";
    this.key.castShadow = quality === "high";
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.setQuality(this.quality);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Landscape lays the objects out in a row. Portrait stacks them in the upper part of the screen,
    // above the control sheet, and the camera backs off to fit.
    const portrait = aspect < 1;
    this.props.forEach((prop, i) => {
      const offset = (i - 1) * (portrait ? 2.3 : 2.7);
      prop.home.position.set(portrait ? 0 : offset, portrait ? -offset : 0, 0);
    });
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const needHalfWidth = portrait ? 1.6 : 4.2;
    const needHalfHeight = portrait ? 6.8 : 2.2;
    const distance = Math.max(needHalfHeight / Math.tan(halfFov), needHalfWidth / (Math.tan(halfFov) * aspect));
    this.camera.position.set(0, 0.4, distance);
    this.camera.lookAt(0, 0, 0);
    if (portrait) this.camera.setViewOffset(width, height, 0, height * 0.17, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  apply(actions: Action[]): void {
    for (const action of actions) {
      const target = this.selected.target;
      switch (action.type) {
        case "hover":
          this.hovered = this.pick(action.x, action.y);
          break;
        case "select": {
          // Selecting empty space keeps the current selection, so a pinch that misses never drops it.
          const hit = this.pick(action.x, action.y);
          if (hit) this.selected = hit;
          break;
        }
        case "rotate":
          target.quaternion
            .premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, action.yaw))
            .premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, action.pitch));
          break;
        case "roll":
          target.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, -action.radians));
          break;
        case "scale":
          target.scale = THREE.MathUtils.clamp(target.scale * action.factor, MIN_SCALE, MAX_SCALE);
          break;
        case "reset":
          for (const prop of this.props) {
            prop.target.quaternion.identity();
            prop.target.scale = 1;
          }
          break;
      }
    }
    this.refreshHighlights();
  }

  clearHover(): void {
    if (!this.hovered) return;
    this.hovered = null;
    this.refreshHighlights();
  }

  render(dtMs: number): void {
    const dt = Math.min(dtMs, 100) / 1000;
    this.elapsed += dt;
    const k = 1 - Math.exp(-FOLLOW_RATE * dt);
    this.props.forEach((prop, i) => {
      prop.root.quaternion.slerp(prop.target.quaternion, k);
      prop.root.scale.setScalar(THREE.MathUtils.lerp(prop.root.scale.x, prop.target.scale, k));
      prop.root.position.copy(prop.home.position);
      prop.root.position.y += Math.sin(this.elapsed * 1.1 + i * 2.1) * 0.08;
    });
    this.renderer.render(this.scene, this.camera);
  }

  snapshot(): StageSnapshot {
    const e = new THREE.Euler().setFromQuaternion(this.selected.target.quaternion);
    const deg = THREE.MathUtils.radToDeg;
    return {
      selected: this.selected.name,
      hovered: this.hovered?.name ?? null,
      rotation: { x: deg(e.x), y: deg(e.y), z: deg(e.z) },
      scale: this.selected.target.scale,
    };
  }

  dispose(): void {
    for (const prop of this.props) prop.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }

  private pick(x: number, y: number): Prop | null {
    this.raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, -(y * 2 - 1)), this.camera);
    const hit = this.raycaster.intersectObjects(this.props.map((p) => p.mesh), false)[0];
    return this.props.find((p) => p.mesh === hit?.object) ?? null;
  }

  private refreshHighlights(): void {
    for (const prop of this.props) prop.highlight(prop === this.selected, prop === this.hovered);
  }
}
