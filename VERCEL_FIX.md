# Vercel Deployment Fix

If you're still getting 404 errors, please check the following in your Vercel dashboard:

## Manual Configuration Steps:

1. **Go to your project settings in Vercel**
2. **Check "Build & Development Settings":**
   - **Framework Preset**: Select "Other" or leave blank
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/fbx-motion-capture`
   - **Install Command**: `npm install`
   - **Node.js Version**: 18.x or higher

3. **Environment Variables**: None needed

4. **Redeploy** after making these changes

## Alternative: Delete and Re-import

If it still doesn't work:
1. Delete the project from Vercel
2. Re-import from GitHub
3. Manually set the settings above
4. Deploy

## Verify Build Output

After deployment, check the build logs to ensure:
- Build completes successfully
- Output directory contains `index.html`
- Assets folder is present

