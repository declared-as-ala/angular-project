import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface Status {
  message: string;
  type: 'info' | 'success' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class MotionCaptureService {
  private statusSubject = new BehaviorSubject<Status>({ message: 'Initializing...', type: 'info' });
  private animationsSubject = new BehaviorSubject<any[]>([]);
  private isAnimationPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentAnimationSubject = new BehaviorSubject<any>(null);

  status$: Observable<Status> = this.statusSubject.asObservable();
  animations$: Observable<any[]> = this.animationsSubject.asObservable();
  isAnimationPlaying$: Observable<boolean> = this.isAnimationPlayingSubject.asObservable();
  currentAnimation$: Observable<any> = this.currentAnimationSubject.asObservable();

  private renderer: any;
  private scene: any;
  private camera: any;
  private controls: any;
  private currentModel: any = null;
  private skeletonHelper: any = null;
  private initRotation: any = {};
  private isTracking = false;
  private morphTargetCache: Map<any, any> | null = null;
  private holistic: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private positionOffset = { x: 0, y: 1, z: 0 };
  private trackingTarget: 'face' | 'half' | 'full' = 'face';
  private currentMode: 'tracking' | 'animation' = 'tracking';
  private animationMixer: any = null;
  // Smooth eye blink values to prevent glitches
  private previousLeftBlink = 0;
  private previousRightBlink = 0;
  // Smooth mouth opening values to prevent glitches
  private previousMouthOpen = 0;
  private animationClock: any = null;
  private currentAnimation: any = null;
  private availableAnimations: any[] = [];
  private isAnimationPlaying = false;

  private mixamoBoneMapping = {
    "Hips": { name: "mixamorigHips", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "Neck": { name: "mixamorigNeck", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "Chest": { name: "mixamorigSpine2", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "Spine": { name: "mixamorigSpine", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "RightUpperArm": { name: "mixamorigRightArm", order: "ZXY", func: { fx: "-z", fy: "x", fz: "-y" } },
    "RightLowerArm": { name: "mixamorigRightForeArm", order: "ZXY", func: { fx: "-z", fy: "x", fz: "-y" } },
    "LeftUpperArm": { name: "mixamorigLeftArm", order: "ZXY", func: { fx: "z", fy: "-x", fz: "-y" } },
    "LeftLowerArm": { name: "mixamorigLeftForeArm", order: "ZXY", func: { fx: "z", fy: "-x", fz: "-y" } },
    "LeftUpperLeg": { name: "mixamorigLeftUpLeg", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "LeftLowerLeg": { name: "mixamorigLeftLeg", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "RightUpperLeg": { name: "mixamorigRightUpLeg", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } },
    "RightLowerLeg": { name: "mixamorigRightLeg", order: "XYZ", func: { fx: "-x", fy: "y", fz: "-z" } }
  };

  constructor() {
    this.loadThreeJS();
    this.loadMediaPipe();
    this.loadKalidokit();
  }

  private loadThreeJS(): void {
    // Three.js will be loaded via CDN in index.html
  }

  private loadMediaPipe(): void {
    // MediaPipe will be loaded via CDN in index.html
  }

  private loadKalidokit(): void {
    // Kalidokit will be loaded via CDN in index.html
  }

  private getTHREE(): any {
    // Try to get THREE from window (if loaded via script tag)
    if (typeof (window as any).THREE !== 'undefined') {
      return (window as any).THREE;
    }
    // Try to get from global scope
    if (typeof (globalThis as any).THREE !== 'undefined') {
      return (globalThis as any).THREE;
    }
    // If using import map, we need to import it
    throw new Error('THREE.js is not loaded. Make sure the import map is in index.html');
  }

  initializeThreeJS(container: HTMLElement): void {
    // Get THREE.js
    let THREE: any;
    try {
      THREE = this.getTHREE();
    } catch (error: any) {
      console.error('THREE.js is not loaded:', error);
      this.updateStatus('Error: THREE.js not loaded', 'error');
      return;
    }

    // Initialize animation clock
    if (!this.animationClock) {
      this.animationClock = new THREE.Clock();
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    const aspect = container.clientWidth / container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(0, 2, 5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Controls - will be set up asynchronously
    this.setupControlsAsync();

    // Grid and axes
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    this.scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(2);
    this.scene.add(axesHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(5, 5, 5);
    this.scene.add(directionalLight1);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-5, 3, -5);
    this.scene.add(directionalLight2);
    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight3.position.set(0, 10, 0);
    this.scene.add(directionalLight3);

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Animation loop
    this.animate();
  }

  private async setupControlsAsync(): Promise<void> {
    try {
      const module = await import('three/addons/controls/OrbitControls.js');
      const { OrbitControls } = module;
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.setupControls();
    } catch (error) {
      console.error('Error loading OrbitControls:', error);
    }
  }

  private setupControls(): void {
    if (!this.controls) return;
    const THREE = this.getTHREE();
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.2;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.enableRotate = true;
    this.controls.autoRotate = false;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    this.controls.update();

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.touchAction = 'none';
      this.renderer.domElement.style.pointerEvents = 'auto';
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    if (this.currentMode === 'animation' && this.animationMixer && this.isAnimationPlaying) {
      const delta = this.animationClock.getDelta();
      if (delta > 0 && delta < 0.1) {
        this.animationMixer.update(delta);
      }
    }

    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Continue with other methods from app.js...
  // I'll add the key methods needed

  updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.statusSubject.next({ message, type });
  }

  switchMode(mode: 'tracking' | 'animation'): void {
    this.currentMode = mode;
    if (mode === 'animation' && this.currentModel) {
      this.loadAllAnimations();
    }
  }

  changeTarget(target: 'face' | 'half' | 'full'): void {
    this.trackingTarget = target;
    switch (target) {
      case 'face':
        this.positionOffset = { x: 0, y: 1.0, z: 0 };
        break;
      case 'half':
        this.positionOffset = { x: 0, y: 1.1, z: 1 };
        break;
      case 'full':
        this.positionOffset = { x: 0, y: 1.4, z: 2 };
        break;
    }
  }

  async loadDefaultModel(): Promise<void> {
    // Wait a bit to ensure THREE is fully loaded and Angular change detection is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.updateStatus('Loading default model: Remy.fbx...', 'info');
    try {
      const THREE = this.getTHREE();
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      
      // Create loader (FBXLoader doesn't take a manager parameter)
      const loader = new FBXLoader();
      
      // Try loading the file manually to check if it's accessible and valid
      const modelPath = '/assets/Remy.fbx';
      console.log('Attempting to load model from:', modelPath);
      
      // First, try to fetch the file to verify it exists and check its content
      try {
        const response = await fetch(modelPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        console.log('File content-type:', contentType);
        console.log('File size:', response.headers.get('content-length'), 'bytes');
        
        // Clone the response so we can read it multiple times if needed
        const responseClone = response.clone();
        
        // Read as array buffer to preserve binary format
        const arrayBuffer = await response.arrayBuffer();
        console.log('File loaded as ArrayBuffer, size:', arrayBuffer.byteLength, 'bytes');
        
        // Check first few bytes to see if it's a valid FBX file
        const view = new Uint8Array(arrayBuffer);
        const header = String.fromCharCode.apply(null, Array.from(view.slice(0, Math.min(20, view.length))));
        console.log('File header (first 20 bytes):', header);
        
        // Try parsing with FBXLoader as binary
        try {
          const model = loader.parse(arrayBuffer, modelPath);
          if (model) {
            this.processLoadedModel(model);
            this.updateStatus('Default model Remy.fbx loaded successfully!', 'success');
            return;
          } else {
            throw new Error('Model parsed but result is null');
          }
        } catch (parseError: any) {
          console.error('FBXLoader binary parse error:', parseError);
          // The file might be text-based FBX, try loading as text and converting to ArrayBuffer
          try {
            const text = await responseClone.text();
            console.log('File loaded as text, first 100 chars:', text.substring(0, 100));
            // Convert text to ArrayBuffer for parsing
            const encoder = new TextEncoder();
            const textArrayBuffer = encoder.encode(text).buffer;
            const textModel = loader.parse(textArrayBuffer, modelPath);
            if (textModel) {
              this.processLoadedModel(textModel);
              this.updateStatus('Default model Remy.fbx loaded successfully!', 'success');
              return;
            }
          } catch (textError: any) {
            console.error('FBXLoader text parse error:', textError);
            throw parseError; // Throw the original binary parse error
          }
          throw parseError;
        }
      } catch (fetchError: any) {
        console.error('Error fetching file:', fetchError);
        // Fallback: try using loader.load() directly
        console.log('Falling back to loader.load() method');
        try {
          const model = await new Promise((resolve, reject) => {
            loader.load(
              modelPath,
              (object: any) => {
                console.log('Model loaded successfully:', object);
                if (object) {
                  resolve(object);
                } else {
                  reject(new Error('Model loaded but object is null'));
                }
              },
              (progress: any) => {
                if (progress && progress.total > 0) {
                  const percent = (progress.loaded / progress.total) * 100;
                  this.updateStatus(`Loading Remy.fbx... ${percent.toFixed(0)}%`, 'info');
                } else if (progress && progress.loaded) {
                  this.updateStatus(`Loading Remy.fbx... ${progress.loaded} bytes`, 'info');
                }
              },
              (error: any) => {
                console.error('FBXLoader.load() error:', error);
                reject(error);
              }
            );
          });
          
          if (model) {
            this.processLoadedModel(model);
            this.updateStatus('Default model Remy.fbx loaded successfully!', 'success');
          } else {
            throw new Error('Model is null after loading');
          }
        } catch (loadError: any) {
          throw fetchError || loadError;
        }
      }
    } catch (error: any) {
      console.error('Error loading default model:', error);
      const errorMsg = error?.message || 'Unknown error';
      this.updateStatus(`Could not load Remy.fbx: ${errorMsg}. Please load a model manually.`, 'error');
    }
  }

  loadFBXModel(file: File): void {
    this.updateStatus('Loading FBX model...', 'info');
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const arrayBuffer = e.target.result;
      try {
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
        const loader = new FBXLoader();
        const model = loader.parse(arrayBuffer, '');
        this.processLoadedModel(model);
        this.updateStatus('Model loaded successfully!', 'success');
      } catch (error: any) {
        console.error('Error loading FBX:', error);
        this.updateStatus('Error loading FBX model: ' + error.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private processLoadedModel(model: any): void {
    const THREE = this.getTHREE();
    
    // Stop any ongoing tracking or animation
    if (this.isTracking) {
      this.stopTracking();
    }
    if (this.isAnimationPlaying) {
      this.stopAnimation();
    }
    
    // Remove old model
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;
    }

    // Reset animation mixer
    if (this.animationMixer) {
      this.animationMixer = null;
    }

    // Reset initial rotations
    this.initRotation = {};
    
    // Clear morph target cache (will be rebuilt)
    this.morphTargetCache = null;
    
    // Reset eye blink smoothing values
    this.previousLeftBlink = 0;
    this.previousRightBlink = 0;
    // Reset mouth opening smoothing value
    this.previousMouthOpen = 0;

    // Scale and position model
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 10) {
      const scale = 2 / maxDim;
      model.scale.set(scale, scale, scale);
    } else if (maxDim < 0.1) {
      const scale = 2 / maxDim;
      model.scale.set(scale, scale, scale);
    } else {
      model.scale.set(0.01, 0.01, 0.01);
    }

    model.position.set(0, 0, 0);
    model.rotation.y = Math.PI;

    this.scene.add(model);
    this.currentModel = model;

    // Create new skeleton helper for the new model
    this.skeletonHelper = new THREE.SkeletonHelper(model);
    this.skeletonHelper.visible = false;
    this.scene.add(this.skeletonHelper);

    // Store initial rotations for the new model
    this.storeInitialRotations();
    
    // Initialize animation mixer for the new model
    if (this.currentModel) {
      this.animationMixer = new THREE.AnimationMixer(this.currentModel);
    }
    
    console.log('Model loaded and skeleton initialized. Bones found:', this.skeletonHelper.bones?.length || 0);

    // Extract animations
    let modelAnimations: any[] = [];
    if (model.animations && Array.isArray(model.animations) && model.animations.length > 0) {
      modelAnimations = model.animations;
    } else {
      model.traverse((child: any) => {
        if (child.animations && child.animations.length > 0) {
          modelAnimations.push(...child.animations);
        }
      });
    }

    if (modelAnimations.length > 0) {
      this.availableAnimations = [...modelAnimations];
      this.animationsSubject.next(this.availableAnimations);
    } else {
      this.availableAnimations = [];
      this.animationsSubject.next([]);
    }

    // Adjust camera
    const newBox = new THREE.Box3().setFromObject(model);
    const newSize = newBox.getSize(new THREE.Vector3());
    const newCenter = newBox.getCenter(new THREE.Vector3());
    const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z);
    const distance = newMaxDim * 2.5;
    this.camera.position.set(
      newCenter.x,
      newCenter.y + newSize.y * 0.3,
      newCenter.z + distance
    );
    if (this.controls) {
      this.controls.target.copy(newCenter);
      this.controls.minDistance = newMaxDim * 0.5;
      this.controls.maxDistance = newMaxDim * 10;
      this.controls.update();
    }
  }

  private storeInitialRotations(): void {
    this.initRotation = {};
    if (!this.skeletonHelper || !this.skeletonHelper.bones) {
      console.warn('SkeletonHelper or bones not available');
      return;
    }

    console.log('Storing initial rotations. Available bones:', this.skeletonHelper.bones.map((b: any) => b.name));

    Object.keys(this.mixamoBoneMapping).forEach(boneName => {
      const mapping = this.mixamoBoneMapping[boneName as keyof typeof this.mixamoBoneMapping];
      const bone = this.skeletonHelper.bones.find((b: any) => b.name === mapping.name);
      if (bone) {
        this.initRotation[boneName] = {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z
        };
        console.log(`Stored initial rotation for ${boneName} (${mapping.name})`);
      } else {
        console.warn(`Bone not found: ${mapping.name} for ${boneName}`);
      }
    });
    
    console.log('Initial rotations stored:', Object.keys(this.initRotation).length, 'bones');
  }

  async startTracking(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    if (this.isTracking) {
      this.updateStatus('Tracking is already running!', 'info');
      return;
    }
    if (!this.currentModel) {
      this.updateStatus('Please load an FBX model first!', 'error');
      return;
    }

    try {
      this.videoElement = video;
      this.canvasElement = canvas;
      this.canvasCtx = canvas.getContext('2d');

      if (!this.canvasCtx) {
        throw new Error('Could not get canvas 2D context');
      }

      this.updateStatus('Requesting camera access...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      video.srcObject = stream;
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
      };

      await video.play();
      this.updateStatus('Initializing MediaPipe...', 'info');

      if (!this.holistic) {
        this.initMediaPipe();
      }

      // Wait a bit for video to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const processFrame = async () => {
        if (this.isTracking && video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            await this.holistic.send({ image: video });
          } catch (error: any) {
            console.error('Error processing frame:', error);
          }
        }
        if (this.isTracking) {
          requestAnimationFrame(processFrame);
        }
      };

      this.isTracking = true;
      processFrame();
      this.updateStatus('Tracking started! Move in front of the camera.', 'success');
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      this.isTracking = false;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.updateStatus('Camera access denied. Please allow camera access and try again.', 'error');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.updateStatus('No camera found. Please connect a camera and try again.', 'error');
      } else {
        this.updateStatus('Error starting camera: ' + (error.message || error.name), 'error');
      }
    }
  }

  stopTracking(): void {
    this.isTracking = false;
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    this.updateStatus('Tracking stopped', 'info');
  }

  private initMediaPipe(): void {
    if (typeof Holistic === 'undefined') {
      console.error('MediaPipe Holistic is not loaded. Make sure the script is included in index.html');
      this.updateStatus('Error: MediaPipe not loaded', 'error');
      return;
    }

    try {
      this.holistic = new Holistic({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
        }
      });

      this.holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        refineFaceLandmarks: true
      });

      this.holistic.onResults((results: any) => {
        this.onResults(results);
      });

      console.log('MediaPipe Holistic initialized successfully');
    } catch (error: any) {
      console.error('Error initializing MediaPipe:', error);
      this.updateStatus('Error initializing MediaPipe: ' + error.message, 'error');
    }
  }

  private onResults(results: any): void {
    if (this.canvasCtx && this.canvasElement && this.videoElement) {
      this.drawResults(results);
    }

    if (this.currentMode === 'tracking' && this.currentModel && this.skeletonHelper && this.isTracking) {
      this.animateModel(results);
    }
  }

  private drawResults(results: any): void {
    if (!this.canvasCtx || !this.canvasElement || !this.videoElement) return;

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.poseLandmarks) {
      drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00cff7",
        lineWidth: 4
      });
      drawLandmarks(this.canvasCtx, results.poseLandmarks, {
        color: "#ff0364",
        lineWidth: 2
      });
    }

    if (results.faceLandmarks) {
      drawConnectors(this.canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1
      });
    }

    if (results.leftHandLandmarks) {
      drawConnectors(this.canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "#eb1064",
        lineWidth: 5
      });
    }

    if (results.rightHandLandmarks) {
      drawConnectors(this.canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "#22c3e3",
        lineWidth: 5
      });
    }

    this.canvasCtx.restore();
  }

  private animateModel(results: any): void {
    // Implementation from app.js animateModel function
    // This is a simplified version - you'll need to port the full logic
    const faceLandmarks = results.faceLandmarks;
    const pose3DLandmarks = results.za;
    const pose2DLandmarks = results.poseLandmarks;
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    let riggedPose, riggedFace;

    if (faceLandmarks && (this.trackingTarget === 'face' || this.trackingTarget === 'half' || this.trackingTarget === 'full')) {
      riggedFace = Kalidokit.Face.solve(faceLandmarks, {
        runtime: "mediapipe",
        video: this.videoElement
      });
      if (riggedFace) {
        // Head rotation
        this.rigRotation("Neck", riggedFace.head, 0.7);
        
        // Always apply face morphs for mouth and eyes
        if (this.currentModel) {
          this.applyFaceMorphs(riggedFace);
        }
      }
    }

    if (pose2DLandmarks && pose3DLandmarks && (this.trackingTarget === 'half' || this.trackingTarget === 'full')) {
      riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
        runtime: "mediapipe",
        video: this.videoElement
      });

      if (riggedPose) {
        this.rigRotation("Hips", {
          x: riggedPose.Hips.rotation.x,
          y: riggedPose.Hips.rotation.y,
          z: riggedPose.Hips.rotation.z
        }, 0.7);

        this.rigPosition("Hips", {
          x: riggedPose.Hips.position.x + this.positionOffset.x,
          y: riggedPose.Hips.position.y + this.positionOffset.y,
          z: -riggedPose.Hips.position.z + this.positionOffset.z
        }, 1, 0.07);

        this.rigRotation("Chest", riggedPose.Chest, 0.25, 0.3);
        this.rigRotation("Spine", riggedPose.Spine, 0.45, 0.3);
        this.rigRotation("RightUpperArm", riggedPose.RightUpperArm);
        this.rigRotation("RightLowerArm", riggedPose.RightLowerArm);
        this.rigRotation("LeftUpperArm", riggedPose.LeftUpperArm);
        this.rigRotation("LeftLowerArm", riggedPose.LeftLowerArm);

        if (this.trackingTarget === 'full') {
          this.rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg);
          this.rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg);
          this.rigRotation("RightUpperLeg", riggedPose.RightUpperLeg);
          this.rigRotation("RightLowerLeg", riggedPose.RightLowerLeg);
        }
      }
    }

    if ((this.trackingTarget === 'half' || this.trackingTarget === 'full')) {
      if (leftHandLandmarks) {
        const riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left");
        this.applyHandTracking(riggedLeftHand, leftHandLandmarks, "Left");
      }
      if (rightHandLandmarks) {
        const riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
        this.applyHandTracking(riggedRightHand, rightHandLandmarks, "Right");
      }
    }
  }

  private rigRotation(name: string, rotation: any = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3): void {
    if (!this.skeletonHelper || !this.skeletonHelper.bones) {
      // Silently return if skeleton not ready
      return;
    }
    const THREE = this.getTHREE();

    const mapping = this.mixamoBoneMapping[name as keyof typeof this.mixamoBoneMapping];
    if (!mapping) return;

    const bone = this.skeletonHelper.bones.find((b: any) => b.name === mapping.name);
    if (!bone) {
      // Silently return if bone not found (model might not have this bone)
      return;
    }
    
    // Ensure initial rotation is stored
    if (!this.initRotation[name]) {
      this.initRotation[name] = {
        x: bone.rotation.x,
        y: bone.rotation.y,
        z: bone.rotation.z
      };
    }

    const x = rotation.x * dampener;
    const y = rotation.y * dampener;
    const z = rotation.z * dampener;

    // Apply function transformations
    let fx: number, fy: number, fz: number;
    switch (mapping.func.fx) {
      case '-x': fx = -x; break;
      case 'x': fx = x; break;
      case '-z': fx = -z; break;
      case 'z': fx = z; break;
      default: fx = x;
    }
    switch (mapping.func.fy) {
      case 'y': fy = y; break;
      case '-y': fy = -y; break;
      case 'x': fy = x; break;
      case '-x': fy = -x; break;
      default: fy = y;
    }
    switch (mapping.func.fz) {
      case '-z': fz = -z; break;
      case 'z': fz = z; break;
      case '-y': fz = -y; break;
      case 'y': fz = y; break;
      default: fz = z;
    }

    const euler = new THREE.Euler(
      this.initRotation[name].x + fx,
      this.initRotation[name].y + fy,
      this.initRotation[name].z + fz,
      mapping.order || "XYZ"
    );

    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    bone.quaternion.slerp(quaternion, lerpAmount);
  }

  private rigPosition(name: string, position: any = { x: 0, y: 0, z: 0 }, dampener = 1, lerpAmount = 0.3): void {
    if (!this.skeletonHelper || !this.skeletonHelper.bones) return;
    const THREE = this.getTHREE();

    const mapping = this.mixamoBoneMapping[name as keyof typeof this.mixamoBoneMapping];
    if (!mapping) return;

    const bone = this.skeletonHelper.bones.find((b: any) => b.name === mapping.name);
    if (!bone) return;

    const vector = new THREE.Vector3(
      position.x * dampener * 100,
      position.y * dampener * 100 - 1.2 * 100,
      -position.z * dampener * 100
    );

    bone.position.lerp(vector, lerpAmount);
  }

  private applyHandTracking(riggedHand: any, landmarks: any, side: string): void {
    if (!riggedHand || !this.skeletonHelper || !landmarks || landmarks.length < 21) return;
    const THREE = this.getTHREE();

    const handBoneName = side === "Left" ? "mixamorigLeftHand" : "mixamorigRightHand";
    const handBone = this.skeletonHelper.bones.find((b: any) => b.name === handBoneName);

    if (handBone && riggedHand[side + "Wrist"]) {
      const wristRot = riggedHand[side + "Wrist"];
      const euler = new THREE.Euler(
        wristRot.x * 0.7,
        wristRot.y * 0.7,
        wristRot.z * 0.7,
        "XYZ"
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      handBone.quaternion.slerp(quaternion, 0.7); // Much higher lerp for immediate response
    }

    // Finger bone mapping
    const fingerBones: any = {
      "Left": {
        "Thumb": ["mixamorigLeftHandThumb1", "mixamorigLeftHandThumb2", "mixamorigLeftHandThumb3"],
        "Index": ["mixamorigLeftHandIndex1", "mixamorigLeftHandIndex2", "mixamorigLeftHandIndex3"],
        "Middle": ["mixamorigLeftHandMiddle1", "mixamorigLeftHandMiddle2", "mixamorigLeftHandMiddle3"],
        "Ring": ["mixamorigLeftHandRing1", "mixamorigLeftHandRing2", "mixamorigLeftHandRing3"],
        "Pinky": ["mixamorigLeftHandPinky1", "mixamorigLeftHandPinky2", "mixamorigLeftHandPinky3"]
      },
      "Right": {
        "Thumb": ["mixamorigRightHandThumb1", "mixamorigRightHandThumb2", "mixamorigRightHandThumb3"],
        "Index": ["mixamorigRightHandIndex1", "mixamorigRightHandIndex2", "mixamorigRightHandIndex3"],
        "Middle": ["mixamorigRightHandMiddle1", "mixamorigRightHandMiddle2", "mixamorigRightHandMiddle3"],
        "Ring": ["mixamorigRightHandRing1", "mixamorigRightHandRing2", "mixamorigRightHandRing3"],
        "Pinky": ["mixamorigRightHandPinky1", "mixamorigRightHandPinky2", "mixamorigRightHandPinky3"]
      }
    };

    // MediaPipe hand landmarks: 0=wrist, 4=thumb_tip, 8=index_tip, 12=middle_tip, 16=ring_tip, 20=pinky_tip
    const wrist = landmarks[0];
    if (!wrist) return;

    // Calculate individual finger distances using multiple landmark pairs for better accuracy
    const fingerDistances: any = {
      "Thumb": 0,
      "Index": 0,
      "Middle": 0,
      "Ring": 0,
      "Pinky": 0
    };

    // Thumb: use multiple points for better tracking (tip 4, joint 3, base 2)
    if (landmarks[4] && landmarks[2]) {
      const dist1 = Math.hypot(
        landmarks[4].x - landmarks[2].x,
        landmarks[4].y - landmarks[2].y,
        (landmarks[4].z || 0) - (landmarks[2].z || 0)
      );
      const dist2 = landmarks[3] ? Math.hypot(
        landmarks[4].x - landmarks[3].x,
        landmarks[4].y - landmarks[3].y,
        (landmarks[4].z || 0) - (landmarks[3].z || 0)
      ) : dist1;
      fingerDistances.Thumb = (dist1 + dist2) / 2;
    }

    // Index: tip 8, joints 7, 6, base 5
    if (landmarks[8] && landmarks[5]) {
      const dist1 = Math.hypot(
        landmarks[8].x - landmarks[5].x,
        landmarks[8].y - landmarks[5].y,
        (landmarks[8].z || 0) - (landmarks[5].z || 0)
      );
      const dist2 = landmarks[6] ? Math.hypot(
        landmarks[8].x - landmarks[6].x,
        landmarks[8].y - landmarks[6].y,
        (landmarks[8].z || 0) - (landmarks[6].z || 0)
      ) : dist1;
      fingerDistances.Index = (dist1 + dist2) / 2;
    }

    // Middle: tip 12, joints 11, 10, base 9
    if (landmarks[12] && landmarks[9]) {
      const dist1 = Math.hypot(
        landmarks[12].x - landmarks[9].x,
        landmarks[12].y - landmarks[9].y,
        (landmarks[12].z || 0) - (landmarks[9].z || 0)
      );
      const dist2 = landmarks[10] ? Math.hypot(
        landmarks[12].x - landmarks[10].x,
        landmarks[12].y - landmarks[10].y,
        (landmarks[12].z || 0) - (landmarks[10].z || 0)
      ) : dist1;
      fingerDistances.Middle = (dist1 + dist2) / 2;
    }

    // Ring: tip 16, joints 15, 14, base 13
    if (landmarks[16] && landmarks[13]) {
      const dist1 = Math.hypot(
        landmarks[16].x - landmarks[13].x,
        landmarks[16].y - landmarks[13].y,
        (landmarks[16].z || 0) - (landmarks[13].z || 0)
      );
      const dist2 = landmarks[14] ? Math.hypot(
        landmarks[16].x - landmarks[14].x,
        landmarks[16].y - landmarks[14].y,
        (landmarks[16].z || 0) - (landmarks[14].z || 0)
      ) : dist1;
      fingerDistances.Ring = (dist1 + dist2) / 2;
    }

    // Pinky: tip 20, joints 19, 18, base 17
    if (landmarks[20] && landmarks[17]) {
      const dist1 = Math.hypot(
        landmarks[20].x - landmarks[17].x,
        landmarks[20].y - landmarks[17].y,
        (landmarks[20].z || 0) - (landmarks[17].z || 0)
      );
      const dist2 = landmarks[18] ? Math.hypot(
        landmarks[20].x - landmarks[18].x,
        landmarks[20].y - landmarks[18].y,
        (landmarks[20].z || 0) - (landmarks[18].z || 0)
      ) : dist1;
      fingerDistances.Pinky = (dist1 + dist2) / 2;
    }

    // Calculate overall hand closing from all finger tips to wrist
    const fingerTips = [4, 8, 12, 16, 20];
    let avgDistance = 0;
    let validTips = 0;
    fingerTips.forEach(tipIdx => {
      if (landmarks[tipIdx] && wrist) {
        const dist = Math.hypot(
          landmarks[tipIdx].x - wrist.x,
          landmarks[tipIdx].y - wrist.y,
          (landmarks[tipIdx].z || 0) - (wrist.z || 0)
        );
        avgDistance += dist;
        validTips++;
      }
    });
    
    if (validTips > 0) {
      avgDistance /= validTips;
    }
    
    // Improved hand closing calculation - more sensitive and responsive
    const baseDistance = 0.10; // Lower base distance for better sensitivity
    const handCloseAmount = Math.max(0, Math.min(1, 1 - ((avgDistance - baseDistance) * 15))); // Higher multiplier

    // Apply finger rotations with individual finger tracking - more direct and responsive
    const fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
    fingers.forEach(fingerName => {
      const fingerData = riggedHand[side + fingerName];
      if (fingerData) {
        const boneNames = fingerBones[side][fingerName];
        const fingerDistance = fingerDistances[fingerName] || 0;
        
        // Calculate individual finger closing (0 = open, 1 = closed) - more sensitive
        const fingerBaseDistance = 0.06; // Lower base for better sensitivity
        const individualClose = Math.max(0, Math.min(1, 1 - ((fingerDistance - fingerBaseDistance) * 18))); // Higher multiplier
        
        // Combine overall hand closing with individual finger closing - prioritize individual
        const combinedClose = Math.max(handCloseAmount * 0.7, individualClose * 1.0); // Individual finger has priority
        
        boneNames.forEach((boneName: string, idx: number) => {
          const bone = this.skeletonHelper.bones.find((b: any) => b.name === boneName);
          if (bone && fingerData) {
            // Improved closing with individual finger tracking - more aggressive
            let closeFactor = 0;
            if (fingerName === "Thumb") {
              // Thumb: different closing pattern - more responsive
              closeFactor = idx === 0 ? combinedClose * 0.4 : (idx === 1 ? combinedClose * 0.8 : combinedClose * 1.1);
            } else {
              // Other fingers: progressive closing from base to tip - more aggressive
              closeFactor = idx === 0 ? combinedClose * 0.6 : (idx === 1 ? combinedClose * 1.5 : combinedClose * 2.2);
            }
            
            // Apply rotation from Kalidokit + closing factor - direct application
            const rot = {
              x: (fingerData.x || 0) + closeFactor * 2.5, // Higher multiplier
              y: (fingerData.y || 0),
              z: (fingerData.z || 0)
            };
            const euler = new THREE.Euler(rot.x, rot.y, rot.z, "XYZ");
            const quaternion = new THREE.Quaternion().setFromEuler(euler);
            // Much higher lerp for immediate, responsive tracking
            bone.quaternion.slerp(quaternion, 0.85);
          }
        });
      }
    });
  }

  private applyFaceMorphs(riggedFace: any): void {
    if (!this.currentModel || !riggedFace) return;
    
    // Cache morph target dictionaries to avoid repeated traversals
    if (!this.morphTargetCache) {
      this.morphTargetCache = new Map();
      let foundMorphs: string[] = [];
      this.currentModel.traverse((child: any) => {
        if (child && child.morphTargetInfluences && child.morphTargetDictionary) {
          this.morphTargetCache!.set(child, child.morphTargetDictionary);
          // Collect all morph target names for debugging
          Object.keys(child.morphTargetDictionary).forEach(name => {
            if (!foundMorphs.includes(name)) foundMorphs.push(name);
          });
        }
      });
      console.log('Found morph targets:', foundMorphs.slice(0, 20)); // Log first 20
    }
    
    // Apply mouth opening - comprehensive solution with smoothing
    if (riggedFace.mouth) {
      // Based on research and SysMocap: Kalidokit provides mouth.y and mouth.shape
      // SysMocap divides by 0.8 (amplifies by 1.25x) and uses lerp for smoothing
      let targetMouthOpen = 0;
      
      // Primary: mouth.y (vertical opening) - most reliable for jaw opening
      // Kalidokit mouth.y: negative values indicate opening
      if (riggedFace.mouth.y !== undefined) {
        // Use absolute value and amplify significantly for full opening
        // Higher amplification ensures mouth opens fully
        const mouthYValue = Math.abs(riggedFace.mouth.y);
        targetMouthOpen = Math.max(targetMouthOpen, mouthYValue * 4.5); // Increased from 3 to 4.5
      }
      
      // Secondary: mouth.mouthOpen property (if available)
      if (riggedFace.mouth.mouthOpen !== undefined) {
        targetMouthOpen = Math.max(targetMouthOpen, riggedFace.mouth.mouthOpen * 2.0);
      }
      
      // Tertiary: mouth shape properties (I, A, E, O, U) for different mouth shapes
      // These are useful for vowel sounds and expressions
      if (riggedFace.mouth.shape) {
        const shapeValues = [
          riggedFace.mouth.shape.I || 0,  // "ih" sound
          riggedFace.mouth.shape.A || 0,  // "ah" sound (wide open)
          riggedFace.mouth.shape.E || 0,  // "eh" sound
          riggedFace.mouth.shape.O || 0,  // "oh" sound (round open)
          riggedFace.mouth.shape.U || 0   // "oo" sound
        ];
        const maxShape = Math.max(...shapeValues);
        // Amplify shape values more for better visibility
        targetMouthOpen = Math.max(targetMouthOpen, maxShape * 2.5); // Increased from 1.5 to 2.5
      }
      
      // Clamp to valid range
      targetMouthOpen = Math.max(0, Math.min(1, targetMouthOpen));
      
      // Smooth interpolation to prevent glitches (similar to eye blinking)
      // Use lerp factor 0.6 for responsive but smooth mouth movement
      const smoothedMouthOpen = this.previousMouthOpen + (targetMouthOpen - this.previousMouthOpen) * 0.6;
      this.previousMouthOpen = smoothedMouthOpen;
      
      // Apply to all possible mouth morph targets with extensive name variations
      const mouthMorphNames = [
        'jawOpen', 'mouthOpen', 'Mouth_Open', 'jawOpenY', 
        'jawOpenX', 'Jaw_Open', 'mouthOpenY', 'MouthOpen',
        'JawOpen', 'jaw_open', 'mouth_open', 'MouthOpenY',
        'jawOpenZ', 'JawOpenY', 'Mouth_Open_Y', 'jawOpenVertical'
      ];
      
      if (this.morphTargetCache) {
        this.morphTargetCache.forEach((dictionary: any, child: any) => {
          if (!child || !child.morphTargetInfluences) return;
          
          mouthMorphNames.forEach(morphName => {
            const index = dictionary[morphName];
            if (index !== undefined && child.morphTargetInfluences) {
              // Apply smoothed value to morph target
              child.morphTargetInfluences[index] = smoothedMouthOpen;
            }
          });
        });
      }
    }
    
    // Apply eye blinking - improved with better detection and application
    if (riggedFace.eye) {
      // Based on research and user feedback:
      // Kalidokit: 0 = open, 1 = closed
      // The FBX model appears to have inverted morph targets OR default state is wrong
      // User reports: eyes start closed, open when user closes eyes
      // This means: when Kalidokit = 0 (open), morph should be 0 (open)
      //            when Kalidokit = 1 (closed), morph should be 1 (closed)
      // But if eyes start closed, the morph default might be 1
      // Solution: Use Kalidokit value directly (no inversion) and ensure we start at 0
      let leftBlink = 0;
      let rightBlink = 0;
      
      if (riggedFace.eye.l !== undefined) {
        // Kalidokit: 0 = open, 1 = closed
        // Research shows: Some morph targets need values > 1.0 (like 1.22) for full closure
        // SysMocap divides by 0.8 which amplifies (multiplies by 1.25)
        // Solution: Use aggressive amplification and allow values to exceed 1.0
        const rawValue = riggedFace.eye.l; // 0-1 where 1 is closed
        
        // Use very high amplification (4x) to ensure we reach full closure
        // Allow temporary values > 1.0 for stronger effect
        let amplified = rawValue * 4.0;
        
        // Add threshold: if blink is detected (value > 0.2), force stronger closure
        if (rawValue > 0.2) {
          // Use exponential curve for aggressive closing: e^(x*2) - 1
          // This makes small blinks trigger strong closure
          amplified = Math.min(1.3, 1 + (rawValue * 3.5)); // Range: 0.5 to 1.3
        }
        
        // Apply exponential curve for more aggressive response
        // Use inverse exponential: 1 - e^(-x*3) for faster closing
        const curved = 1 - Math.exp(-amplified * 3);
        
        // Invert: when Kalidokit says 0 (open), send 1 to morph (which makes it open in inverted system)
        //         when Kalidokit says 1 (closed), send 0 to morph (which makes it closed in inverted system)
        const targetBlink = Math.max(0, Math.min(1, 1 - curved));
        
        // Smooth interpolation to prevent glitches (lerp with factor 0.5 for smooth but responsive)
        // Higher factor = more responsive but less smooth, lower = smoother but more lag
        leftBlink = this.previousLeftBlink + (targetBlink - this.previousLeftBlink) * 0.5;
        this.previousLeftBlink = leftBlink;
      }
      
      if (riggedFace.eye.r !== undefined) {
        const rawValue = riggedFace.eye.r;
        
        // Same aggressive amplification
        let amplified = rawValue * 4.0;
        
        // Add threshold for stronger closure
        if (rawValue > 0.2) {
          amplified = Math.min(1.3, 0.5 + (rawValue * 3.5));
        }
        
        // Apply exponential curve
        const curved = 1 - Math.exp(-amplified * 3);
        const targetBlink = Math.max(0, Math.min(1, 1 - curved));
        
        // Smooth interpolation to prevent glitches
        rightBlink = this.previousRightBlink + (targetBlink - this.previousRightBlink) * 0.5;
        this.previousRightBlink = rightBlink;
      }
      
      // Apply to eye morph targets with extensive name variations
      const allEyeMorphNames = [
        'eyeBlinkLeft', 'Eye_Blink_Left', 'blinkLeft', 'BlinkLeft', 'EyeBlinkLeft',
        'eyeBlinkRight', 'Eye_Blink_Right', 'blinkRight', 'BlinkRight', 'EyeBlinkRight',
        'eyeBlink', 'Eye_Blink', 'blink', 'Blink', 'EyeBlink',
        'LeftEyeBlink', 'RightEyeBlink', 'LEyeBlink', 'REyeBlink'
      ];
      
      let appliedToMorphs = false;
      
      if (this.morphTargetCache) {
        this.morphTargetCache.forEach((dictionary: any, child: any) => {
          if (!child || !child.morphTargetInfluences) return;
          
          // Try all possible eye morph names
          allEyeMorphNames.forEach(morphName => {
            const index = dictionary[morphName];
            if (index !== undefined && child.morphTargetInfluences) {
              // Determine if it's left, right, or combined
              const lowerName = morphName.toLowerCase();
              if (lowerName.includes('left') || lowerName === 'leyeblink') {
                child.morphTargetInfluences[index] = leftBlink;
                appliedToMorphs = true;
              } else if (lowerName.includes('right') || lowerName === 'reyeblink') {
                child.morphTargetInfluences[index] = rightBlink;
                appliedToMorphs = true;
              } else {
                // Combined blink (use average)
                const avgBlink = (leftBlink + rightBlink) / 2;
                child.morphTargetInfluences[index] = avgBlink;
                appliedToMorphs = true;
              }
            }
          });
        });
      }
      
      // Fallback: If no morph targets found, try to use bone rotation for eyes
      if (!appliedToMorphs && this.skeletonHelper && this.skeletonHelper.bones) {
        // Try to find eye bones (less common but possible)
        const leftEyeBone = this.skeletonHelper.bones.find((b: any) => 
          b.name && (b.name.includes('LeftEye') || b.name.includes('leftEye') || b.name.includes('Eye_L'))
        );
        const rightEyeBone = this.skeletonHelper.bones.find((b: any) => 
          b.name && (b.name.includes('RightEye') || b.name.includes('rightEye') || b.name.includes('Eye_R'))
        );
        
        if (leftEyeBone) {
          const THREE = this.getTHREE();
          // Use blink value directly (no inversion needed)
          const euler = new THREE.Euler(leftBlink * 0.5, 0, 0, 'XYZ');
          const quaternion = new THREE.Quaternion().setFromEuler(euler);
          leftEyeBone.quaternion.slerp(quaternion, 0.8);
        }
        if (rightEyeBone) {
          const THREE = this.getTHREE();
          // Use blink value directly (no inversion needed)
          const euler = new THREE.Euler(rightBlink * 0.5, 0, 0, 'XYZ');
          const quaternion = new THREE.Quaternion().setFromEuler(euler);
          rightEyeBone.quaternion.slerp(quaternion, 0.8);
        }
      }
    }
  }

  async loadAllAnimations(): Promise<void> {
    if (!this.currentModel) return;

    const animationFiles = ['Fast Run.fbx', 'Grab And Slam.fbx', 'Chicken Dance.fbx'];
    const loadedAnimations = new Set(this.availableAnimations.map(a => a.name));

    this.updateStatus('Loading animations...', 'info');

    const loadPromises = animationFiles.map(filename => {
      const cleanName = filename.replace('.fbx', '').replace('.FBX', '');
      if (loadedAnimations.has(cleanName)) {
        return Promise.resolve();
      }
      return this.loadAnimationFile(filename).catch(err => {
        console.warn(`Failed to load ${filename}:`, err);
      });
    });

    await Promise.all(loadPromises);
    this.updateStatus('Animations ready! Click to play.', 'success');
  }

  async loadAnimationFile(filename: string): Promise<void> {
    if (!this.currentModel) {
      this.updateStatus('Please load a model first!', 'error');
      return;
    }

    this.updateStatus(`Loading animation: ${filename}...`, 'info');

    try {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      const animModel: any = await new Promise((resolve, reject) => {
        loader.load(
          `assets/${filename}`,
          (object: any) => resolve(object),
          (progress: any) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total) * 100;
              this.updateStatus(`Loading ${filename}... ${percent.toFixed(0)}%`, 'info');
            }
          },
          (error: any) => reject(error)
        );
      });

      let animations: any[] = [];
      if (animModel && animModel.animations && Array.isArray(animModel.animations) && animModel.animations.length > 0) {
        animations = animModel.animations;
      } else if (animModel && animModel.children && animModel.children.length > 0) {
        animModel.traverse((child: any) => {
          if (child.animations && child.animations.length > 0) {
            animations.push(...child.animations);
          }
        });
      }

      if (animations.length > 0) {
        animations.forEach((anim: any) => {
          const cleanName = filename.replace('.fbx', '').replace('.FBX', '').replace(/\s+/g, ' ').trim();
          if (!anim.name || anim.name === '' || anim.name === 'mixamo.com') {
            anim.name = cleanName;
          }
          if (anim.tracks && anim.tracks.length > 0) {
            const exists = this.availableAnimations.some(a => a.name === anim.name);
            if (!exists) {
              this.availableAnimations.push(anim);
            }
          }
        });

        this.animationsSubject.next(this.availableAnimations);
        this.updateStatus(`✅ Loaded ${animations.length} animation(s) from ${filename}`, 'success');
      } else {
        this.updateStatus(`❌ No animations found in ${filename}`, 'error');
      }
    } catch (error: any) {
      console.error('Error loading animation FBX:', error);
      this.updateStatus('Error loading animation: ' + error.message, 'error');
    }
  }

  loadAnimationFBX(file: File): void {
    this.updateStatus(`Loading animation: ${file.name}...`, 'info');
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const arrayBuffer = e.target.result;
      try {
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
        const loader = new FBXLoader();
        const animModel: any = loader.parse(arrayBuffer, '');

        let animations: any[] = [];
        if (animModel && animModel.animations && Array.isArray(animModel.animations) && animModel.animations.length > 0) {
          animations = animModel.animations;
        } else if (animModel && animModel.children && animModel.children.length > 0) {
          animModel.traverse((child: any) => {
            if (child.animations && child.animations.length > 0) {
              animations.push(...child.animations);
            }
          });
        }

        if (animations.length > 0) {
          animations.forEach((anim: any) => {
            const cleanName = file.name.replace('.fbx', '').replace('.FBX', '').replace(/\s+/g, ' ').trim();
            if (!anim.name || anim.name === '' || anim.name === 'mixamo.com') {
              anim.name = cleanName;
            }
            if (anim.tracks && anim.tracks.length > 0) {
              const exists = this.availableAnimations.some(a => a.name === anim.name);
              if (!exists) {
                this.availableAnimations.push(anim);
              }
            }
          });

          this.animationsSubject.next(this.availableAnimations);
          this.updateStatus(`✅ Loaded ${animations.length} animation(s) from ${file.name}`, 'success');
        } else {
          this.updateStatus(`❌ No animations found in ${file.name}`, 'error');
        }
      } catch (error: any) {
        console.error('Error loading animation FBX:', error);
        this.updateStatus('Error loading animation: ' + error.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  selectAndPlayAnimation(animation: any): void {
    this.currentAnimation = animation;
    this.currentAnimationSubject.next(animation);

    if (animation) {
      this.playAnimation();
    } else {
      this.stopAnimation();
    }
  }

  private playAnimation(): void {
    if (!this.currentAnimation || !this.currentModel) {
      this.updateStatus('No animation selected!', 'error');
      return;
    }

    if (this.isTracking) {
      this.stopTracking();
    }

    if (!this.animationMixer) {
      const THREE = this.getTHREE();
      this.animationMixer = new THREE.AnimationMixer(this.currentModel);
    }

    if (this.animationMixer._actions && this.animationMixer._actions.length > 0) {
      this.animationMixer._actions.forEach((action: any) => {
        action.stop();
        action.reset();
      });
      this.animationMixer._actions = [];
    }

    let action = this.animationMixer.existingAction(this.currentAnimation);
    if (!action) {
      action = this.animationMixer.clipAction(this.currentAnimation);
    }

    const THREE = this.getTHREE();
    action.reset();
    action.setLoop(THREE.LoopRepeat);
    action.setEffectiveTimeScale(1.0);
    action.setEffectiveWeight(1.0);
    action.play();

    this.animationClock.start();
    this.animationClock.elapsedTime = 0;
    this.isAnimationPlaying = true;
    this.isAnimationPlayingSubject.next(true);

    this.updateStatus(`▶️ Playing: ${this.currentAnimation.name || 'Animation'}`, 'success');
  }

  private stopAnimation(): void {
    if (this.animationMixer && this.animationMixer._actions) {
      this.animationMixer._actions.forEach((action: any) => {
        action.stop();
        action.reset();
      });
    }

    this.isAnimationPlaying = false;
    this.isAnimationPlayingSubject.next(false);
    this.animationClock.stop();
    this.currentAnimation = null;
    this.currentAnimationSubject.next(null);
    this.updateStatus('⏹️ Animation stopped', 'info');
  }

  cleanup(): void {
    this.stopTracking();
    this.stopAnimation();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

