import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { MotionCaptureService } from './services/motion-capture.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('modelContainer', { static: false }) modelContainer!: ElementRef;
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('modelInput', { static: false }) modelInput!: ElementRef<HTMLInputElement>;
  @ViewChild('animationInput', { static: false }) animationInput!: ElementRef<HTMLInputElement>;

  currentMode: 'tracking' | 'animation' = 'tracking';
  isTracking = false;
  isAnimationPlaying = false;
  trackingTarget: 'face' | 'half' | 'full' = 'face';
  statusMessage = 'Ready!';
  statusType: 'info' | 'success' | 'error' = 'info';
  availableAnimations: any[] = [];
  currentAnimation: any = null;

  constructor(public motionCaptureService: MotionCaptureService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.motionCaptureService.status$.subscribe(status => {
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.statusMessage = status.message;
        this.statusType = status.type;
        this.cdr.markForCheck();
      }, 0);
    });

    this.motionCaptureService.animations$.subscribe(animations => {
      setTimeout(() => {
        this.availableAnimations = animations;
        this.cdr.markForCheck();
      }, 0);
    });

    this.motionCaptureService.isAnimationPlaying$.subscribe(playing => {
      setTimeout(() => {
        this.isAnimationPlaying = playing;
        this.cdr.markForCheck();
      }, 0);
    });

    this.motionCaptureService.currentAnimation$.subscribe(anim => {
      setTimeout(() => {
        this.currentAnimation = anim;
        this.cdr.markForCheck();
      }, 0);
    });
  }

  ngAfterViewInit(): void {
    if (this.modelContainer) {
      this.motionCaptureService.initializeThreeJS(this.modelContainer.nativeElement);
      // Delay loading default model to avoid change detection issues
      setTimeout(() => {
        this.motionCaptureService.loadDefaultModel();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.motionCaptureService.cleanup();
  }

  switchMode(mode: 'tracking' | 'animation'): void {
    this.currentMode = mode;
    this.motionCaptureService.switchMode(mode);
  }

  async startTracking(): Promise<void> {
    // Ensure view is updated so elements are available
    this.cdr.detectChanges();
    
    // Wait a bit for Angular to render the elements
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!this.videoElement || !this.canvasElement) {
      console.error('Video or canvas element not found');
      console.log('videoElement:', this.videoElement);
      console.log('canvasElement:', this.canvasElement);
      // Try to find elements by ID as fallback
      const video = document.querySelector('video') as HTMLVideoElement;
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (video && canvas) {
        console.log('Found elements via querySelector, using them');
        await this.motionCaptureService.startTracking(video, canvas);
        this.isTracking = true;
        return;
      }
      return;
    }
    
    try {
      await this.motionCaptureService.startTracking(
        this.videoElement.nativeElement,
        this.canvasElement.nativeElement
      );
      this.isTracking = true;
    } catch (error: any) {
      console.error('Error in startTracking:', error);
      this.isTracking = false;
    }
  }

  stopTracking(): void {
    this.motionCaptureService.stopTracking();
    this.isTracking = false;
  }

  changeTarget(target: 'face' | 'half' | 'full'): void {
    this.trackingTarget = target;
    this.motionCaptureService.changeTarget(target);
  }

  onModelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.motionCaptureService.loadFBXModel(input.files[0]);
    }
  }

  onAnimationFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      Array.from(input.files).forEach(file => {
        this.motionCaptureService.loadAnimationFBX(file);
      });
    }
  }

  selectAndPlayAnimation(animation: any): void {
    this.motionCaptureService.selectAndPlayAnimation(animation);
  }
}


