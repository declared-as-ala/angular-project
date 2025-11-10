# FBX Motion Capture - Angular Application

A pure Angular application for loading FBX 3D models and tracking face, hands, and body movements using MediaPipe and Kalidokit.

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Angular CLI (installed globally or locally)

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

Run the development server:
```bash
ng serve
```

The application will be available at `http://localhost:4200`

## Features

- **Tracking Mode**: Real-time motion capture using webcam
  - Face tracking
  - Half body tracking (upper body + hands)
  - Full body tracking
  
- **Animation Mode**: Play Mixamo animations
  - Auto-loads: Fast Run, Grab And Slam, Chicken Dance
  - Click animations to play directly
  - Load custom FBX animations

## Controls

- **Mouse**: Click and drag to rotate the model
- **Mouse Wheel**: Zoom in/out
- **Touch**: Pinch to zoom

## Assets

Place your FBX models and animations in the `src/assets/` folder:
- `Remy.fbx` - Default model (auto-loaded)
- `Fast Run.fbx` - Animation
- `Grab And Slam.fbx` - Animation
- `Chicken Dance.fbx` - Animation

## Building for Production

```bash
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.


