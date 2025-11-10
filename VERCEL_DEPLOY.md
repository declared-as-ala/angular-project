# Deploying to Vercel

## Automatic Deployment

1. Go to [Vercel](https://vercel.com) and sign in with your GitHub account
2. Click "Add New Project"
3. Import the repository: `declared-as-ala/angular-project`
4. Vercel will automatically detect it's an Angular project
5. Configure:
   - **Framework Preset**: Angular
   - **Build Command**: `npm run build` (or `npm run vercel-build`)
   - **Output Directory**: `dist/fbx-motion-capture`
   - **Install Command**: `npm install`
6. Click "Deploy"

## Manual Deployment via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. For production deployment:
   ```bash
   vercel --prod
   ```

## Important Notes

- The app uses CDN resources for Three.js, MediaPipe, and Kalidokit
- FBX files are included in the assets folder
- Make sure Node.js version is 18+ in Vercel settings
- The build output is in `dist/fbx-motion-capture` directory

## Environment Variables

No environment variables are required for this project.

## Troubleshooting

If the build fails:
1. Check Node.js version (should be 18+)
2. Ensure all dependencies are in `package.json`
3. Check build logs in Vercel dashboard

