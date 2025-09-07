# SVG to STL API

This API server provides an endpoint to convert SVG files to STL 3D models using the existing bekuto3d Vue components directly.

## Features

- Direct integration with bekuto3d Vue components
- SVG to 3D model conversion using Three.js
- STL file export
- File upload support via multipart/form-data
- CORS enabled for cross-origin requests

## Installation

1. Navigate to the API directory:
```bash
cd src/api
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will start on port 3001 by default.

### API Endpoints

#### Health Check
```
GET /api/health
```

Returns server status and timestamp.

#### Download STL File
```
GET /api/download/:filename
```

Downloads a previously generated STL file by filename.

#### Convert SVG to STL
```
POST /api/svg-to-stl
```

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: SVG file (any form field name accepted)
- Optional Parameters:
  - `depth`: Extrusion depth in mm (default: 2)
  - `size`: Model size in mm (default: 37)

**Response:**
- Content-Type: application/json
- Body: JSON object with download link and metadata

**Response Format:**
```json
{
  "success": true,
  "message": "SVG successfully converted to STL",
  "downloadUrl": "http://localhost:3001/api/download/filename.stl",
  "filename": "filename.stl",
  "fileSize": 12345,
  "shapes": 3,
  "parameters": {
    "depth": 2,
    "size": 37
  }
}
```

**Example using curl:**
```bash
# First, convert SVG to get download link
curl -X POST \
  -F "file=@your-file.svg" \
  -F "depth=2" \
  -F "size=100" \
  http://localhost:3001/api/svg-to-stl

# Response will be JSON with downloadUrl:
# {"success":true,"downloadUrl":"http://localhost:3001/api/download/filename.stl",...}

# Then download the STL file
curl -o output.stl "http://localhost:3001/api/download/filename.stl"
```

**Example using JavaScript:**
```javascript
const formData = new FormData()
formData.append('file', svgFile)
formData.append('depth', '2')
formData.append('size', '100')

const response = await fetch('http://localhost:3001/api/svg-to-stl', {
  method: 'POST',
  body: formData
})

const result = await response.json()
if (result.success) {
  // Download the STL file using the provided URL
  const a = document.createElement('a')
  a.href = result.downloadUrl
  a.download = result.filename
  a.click()
  
  console.log(`Used parameters: depth=${result.parameters.depth}, size=${result.parameters.size}`)
}
```

### Testing

Run the test client to verify the API is working:

```bash
node test-client.js
```

This will:
1. Check the health endpoint
2. Convert a test SVG to STL
3. Save the result as `output.stl`

## Configuration

The API uses the same default values as the original bekuto3d Vue components:

- Default depth: 2mm
- Default size: 37mm
- Curve segments: 64
- Default color: #FFA500 (orange)

## Supported File Types

- SVG files (.svg, image/svg+xml)
- Note: Bitmap images (PNG, JPG, etc.) are not supported in this server implementation

## Error Handling

The API returns appropriate HTTP status codes:

- 200: Success
- 400: Bad request (invalid file, no file provided, etc.)
- 500: Internal server error

Error responses include JSON with error details:
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Architecture

This API directly uses the existing bekuto3d Vue components:

1. **SVG Processing**: Uses the `useSvgLoader` composable logic to parse SVG files and create shapes
2. **3D Model Creation**: Creates Three.js geometries using the same logic as `ModelRenderer`
3. **STL Export**: Uses the same `STLExporter` from `ModelExporter` component

The server sets up a DOM environment using JSDOM to make Three.js work in Node.js.

## Limitations

- Bitmap image conversion (PNG/JPG to SVG) is not implemented in the server version
- Only supports SVG files as input
- Uses default styling and parameters (no customization via API)

## Development

To extend the API:

1. Add new endpoints in `svg-to-stl-server.js`
2. Modify the conversion parameters as needed
3. Add support for additional export formats (GLTF, 3MF, etc.)
4. Implement bitmap image conversion using potrace
