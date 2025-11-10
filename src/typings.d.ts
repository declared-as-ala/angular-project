declare const THREE: any;
declare const Holistic: any;
declare const Kalidokit: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;
declare const POSE_CONNECTIONS: any;
declare const HAND_CONNECTIONS: any;
declare const FACEMESH_TESSELATION: any;

// Three.js addons module declarations
declare module 'three/addons/controls/OrbitControls.js' {
  export class OrbitControls {
    constructor(camera: any, domElement: HTMLElement);
    target: any;
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    enableZoom: boolean;
    minDistance: number;
    maxDistance: number;
    rotateSpeed: number;
    zoomSpeed: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    enableRotate: boolean;
    autoRotate: boolean;
    mouseButtons: any;
    touches: any;
    update(): void;
  }
}

declare module 'three/addons/loaders/FBXLoader.js' {
  export class FBXLoader {
    load(url: string, onLoad?: (object: any) => void, onProgress?: (progress: any) => void, onError?: (error: any) => void): void;
    parse(buffer: ArrayBuffer, path: string): any;
  }
}


