import express from 'express'
import multer from 'multer'
import { createRequire } from 'module'
import { JSDOM } from 'jsdom'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Set up DOM environment for Three.js
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.Image = dom.window.Image
global.URL = dom.window.URL
global.Blob = dom.window.Blob
global.FileReader = dom.window.FileReader
global.DOMParser = dom.window.DOMParser
global.XMLSerializer = dom.window.XMLSerializer

// Import Three.js and related modules
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { ExtrudeGeometry } from 'three'
import { Shape } from 'three'
import { BufferGeometry } from 'three'
import { Group } from 'three'
import { Mesh } from 'three'
import { MeshLambertMaterial } from 'three'
import { Box3 } from 'three'
import { Vector3 } from 'three'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const port = process.env.PORT || 3001

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Default values from SvgTo3D.vue
const defaultDepth = 2
const defaultSize = 37
const curveSegments = 64

// SVG to 3D conversion function (extracted from useSvgLoader.ts)
function createShapesWithColor(svgData, options = {}) {
  const {
    defaultColor = '#000000', // Changed to black
    defaultDepth = 2,
    defaultStartZ = 0,
    drawFillShapes = true,
    customShapes,
  } = options

  const loader = new SVGLoader()
  const svgParsed = loader.parse(svgData)
  const shapes = []

  svgParsed.paths.forEach((path) => {
    // Process fill shapes
    if (drawFillShapes) {
      const fillColor = path.userData?.style?.fill || defaultColor
      const fillOpacity = path.userData?.style?.fillOpacity ?? 1

      if (fillColor !== undefined && fillColor !== 'none') {
        const pathShapes = SVGLoader.createShapes(path)
        pathShapes.forEach((shape) => {
          shapes.push({
            shape: shape,
            color: new THREE.Color().setStyle(fillColor),
            startZ: defaultStartZ,
            depth: defaultDepth,
            opacity: fillOpacity,
            polygonOffset: 0,
          })
        })
      }
    }
  })

  return customShapes ? customShapes(shapes, 0) : shapes
}

// Convert SVG shapes to 3D model (extracted from ModelRenderer logic)
function createModelFromShapes(shapes, targetSize = defaultSize) {
  const modelGroup = new Group()
  
  // First, create all meshes without scaling
  shapes.forEach((shapeData) => {
    if (shapeData.depth <= 0) return

    const extrudeSettings = {
      depth: shapeData.depth,
      bevelEnabled: false,
      curveSegments: curveSegments,
    }

    const geometry = new ExtrudeGeometry(shapeData.shape, extrudeSettings)
    
    // Apply Z offset
    geometry.translate(0, 0, shapeData.startZ)

    const material = new MeshLambertMaterial({
      color: shapeData.color,
      transparent: true,
      opacity: shapeData.opacity,
    })

    const mesh = new Mesh(geometry, material)
    mesh.position.set(0, 0, 0)
    modelGroup.add(mesh)
  })

  // Rotate the model 180 degrees around Z-axis to fix upside down issue
  modelGroup.rotateZ(Math.PI)
  
  // Flip the model horizontally to fix left-right mirror issue
  modelGroup.scale.set(-1, 1, 1)
  
  // Now calculate the actual size and scale the entire group
  if (targetSize > 0) {
    const box = new THREE.Box3().setFromObject(modelGroup, true)
    const actualSize = new THREE.Vector3()
    box.getSize(actualSize)
    
    console.log(`Model dimensions before scaling: ${actualSize.x.toFixed(2)} x ${actualSize.y.toFixed(2)} x ${actualSize.z.toFixed(2)} mm`)
    
    // Calculate scale to achieve target size (use the larger dimension)
    const maxDimension = Math.max(actualSize.x, actualSize.y)
    if (maxDimension > 0) {
      const scale = targetSize / maxDimension
      // Apply scaling while preserving the X-axis flip and Z (depth) scaling
      modelGroup.scale.set(-scale, scale, 1)
      
      // Calculate final dimensions after scaling
      const finalBox = new THREE.Box3().setFromObject(modelGroup, true)
      const finalSize = new THREE.Vector3()
      finalBox.getSize(finalSize)
      
      console.log(`Model dimensions after scaling: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)} mm`)
      console.log(`Scale factor applied: ${scale.toFixed(3)} (X,Y only)`)
    }
  }

  return modelGroup
}

// STL export function (extracted from ModelExporter.vue)
function exportToSTL(modelGroup) {
  const exporter = new STLExporter()
  const result = exporter.parse(modelGroup, { binary: true })
  return result
}

// Main conversion endpoint
app.post('/api/svg-to-stl', upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No SVG file provided' })
    }

    const file = req.files[0]
    
    // Get parameters from request body or query parameters
    const depth = parseFloat(req.body.depth) || parseFloat(req.query.depth) || defaultDepth
    const size = parseFloat(req.body.size) || parseFloat(req.query.size) || defaultSize
    
    console.log(`Processing with depth: ${depth}, size: ${size}`)
    
    let svgData

    // Handle different file types
    if (file.mimetype === 'image/svg+xml' || file.originalname.endsWith('.svg')) {
      // Direct SVG file
      svgData = file.buffer.toString('utf-8')
    } else if (file.mimetype.startsWith('image/')) {
      // Bitmap image - convert to SVG using potrace
      // For now, we'll return an error for bitmap images
      // In a full implementation, you'd integrate potrace here
      return res.status(400).json({ 
        error: 'Bitmap images not supported in this server implementation. Please provide an SVG file.' 
      })
    } else {
      return res.status(400).json({ error: 'Unsupported file type' })
    }

    // Validate SVG
    if (!svgData || !svgData.includes('<svg')) {
      return res.status(400).json({ error: 'Invalid SVG file' })
    }

    // Process SVG to create shapes
    const shapes = createShapesWithColor(svgData, {
      defaultDepth: depth,
      defaultStartZ: 0,
    })

    if (shapes.length === 0) {
      return res.status(400).json({ error: 'No valid shapes found in SVG' })
    }

    // Create 3D model
    const modelGroup = createModelFromShapes(shapes, size)

    // Export to STL
    const stlData = exportToSTL(modelGroup)

    // Generate a unique filename
    const timestamp = Date.now()
    const filename = `${file.originalname.replace(/\.[^/.]+$/, '')}_${timestamp}.stl`
    
    // Store the file temporarily (in a real app, you'd use a proper file storage)
    const fs = await import('fs')
    const path = await import('path')
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, stlData)
    
    // Return JSON response with download link
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/download/${filename}`
    
    res.json({
      success: true,
      message: 'SVG successfully converted to STL',
      downloadUrl: downloadUrl,
      filename: filename,
      fileSize: stlData.length,
      shapes: shapes.length,
      parameters: {
        depth: depth,
        size: size
      }
    })

  } catch (error) {
    console.error('Error converting SVG to STL:', error)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SVG to STL API',
    version: '1.0.0',
    description: 'Convert SVG files to STL 3D models',
    endpoints: {
      health: '/api/health',
      convert: 'POST /api/svg-to-stl',
      download: 'GET /api/download/:filename'
    },
    usage: {
      method: 'POST',
      url: '/api/svg-to-stl',
      contentType: 'multipart/form-data',
      parameters: {
        file: 'SVG file (required)',
        depth: 'Extrusion depth in mm (optional, default: 2)',
        size: 'Model size in mm (optional, default: 37)'
      }
    }
  })
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})

// Download endpoint for STL files
app.get('/api/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename
    const path = await import('path')
    const fs = await import('fs')
    
    const filePath = path.join(process.cwd(), 'temp', filename)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err)
        res.status(500).json({ error: 'Error downloading file' })
      } else {
        // Clean up the file after download (optional)
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              console.log(`Cleaned up file: ${filename}`)
            }
          } catch (cleanupErr) {
            // Only log if it's not a "file not found" error
            if (cleanupErr.code !== 'ENOENT') {
              console.error('Error cleaning up file:', cleanupErr)
            }
          }
        }, 5000) // Delete after 5 seconds
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error)
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  })
})

// Start server
app.listen(port, () => {
  console.log(`SVG to STL API server running on port ${port}`)
  console.log(`Health check: http://localhost:${port}/api/health`)
  console.log(`Convert endpoint: POST http://localhost:${port}/api/svg-to-stl`)
})

export default app
