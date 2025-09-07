# Deploy SVG to STL API to Render

This guide will help you deploy the SVG to STL API to Render.com.

## Prerequisites

1. A Render.com account (free tier available)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### 1. Prepare Your Repository

Make sure your code is pushed to a Git repository with the API files in the `src/api/` directory.

### 2. Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your Git repository
4. Choose the repository containing your code

### 3. Configure the Service

**Basic Settings:**
- **Name**: `svg-to-stl-api` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose the closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `src/api`

**Build & Deploy:**
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Environment Variables:**
- `NODE_ENV`: `production`

**Health Check:**
- **Health Check Path**: `/api/health`

### 4. Advanced Settings (Optional)

**Auto-Deploy:**
- Enable "Auto-Deploy" to automatically deploy when you push to the main branch

**Custom Domain:**
- You can add a custom domain in the "Custom Domains" section

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your service
3. Wait for the deployment to complete (usually 2-5 minutes)

### 6. Test Your Deployment

Once deployed, you'll get a URL like: `https://your-app-name.onrender.com`

Test the API:
```bash
# Health check
curl https://your-app-name.onrender.com/api/health

# Test conversion
curl -X POST \
  -F "file=@your-file.svg" \
  -F "depth=2" \
  -F "size=100" \
  https://your-app-name.onrender.com/api/svg-to-stl
```

## Important Notes

### Free Tier Limitations
- **Sleep Mode**: Free services sleep after 15 minutes of inactivity
- **Cold Start**: First request after sleep may take 30+ seconds
- **Build Time**: 90 minutes per month
- **Bandwidth**: 100GB per month

### Production Considerations
- Consider upgrading to a paid plan for production use
- Add proper error monitoring (e.g., Sentry)
- Implement rate limiting for public APIs
- Add authentication if needed

### Environment Variables for Production
You may want to add these environment variables:
- `PORT`: Render automatically sets this
- `NODE_ENV`: Set to `production`
- `MAX_FILE_SIZE`: Limit file upload size
- `CORS_ORIGIN`: Restrict CORS origins

## Troubleshooting

### Common Issues

1. **Build Fails**: Check that all dependencies are in `package.json`
2. **Service Won't Start**: Verify the start command is correct
3. **Health Check Fails**: Ensure `/api/health` endpoint returns 200
4. **File Upload Issues**: Check file size limits and CORS settings

### Logs
- View logs in the Render dashboard under "Logs" tab
- Check for any error messages during build or runtime

## Example Usage After Deployment

```javascript
const API_URL = 'https://your-app-name.onrender.com/api/svg-to-stl'

const formData = new FormData()
formData.append('file', svgFile)
formData.append('depth', '2')
formData.append('size', '100')

const response = await fetch(API_URL, {
  method: 'POST',
  body: formData
})

const result = await response.json()
if (result.success) {
  // Download the STL file
  const a = document.createElement('a')
  a.href = result.downloadUrl
  a.download = result.filename
  a.click()
}
```

## Support

If you encounter issues:
1. Check the Render documentation: https://render.com/docs
2. Review the logs in your Render dashboard
3. Ensure your local API works before deploying
