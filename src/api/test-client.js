import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

const API_URL = 'http://localhost:3001/api/svg-to-stl'

async function testSvgToStlConversion() {
  try {
    // Check if we have a test SVG file
    const testSvgPath = '../../public/model/bekuto3d.svg'
    
    if (!fs.existsSync(testSvgPath)) {
      console.log('No test SVG file found. Creating a simple test SVG...')
      
      // Create a simple test SVG
      const testSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="80" fill="#FFA500" stroke="#000" stroke-width="2"/>
  <circle cx="50" cy="50" r="20" fill="#FF0000"/>
</svg>`
      
      fs.writeFileSync('test.svg', testSvg)
      console.log('Created test.svg file')
    }

    // Read the SVG file
    const svgPath = fs.existsSync(testSvgPath) ? testSvgPath : 'test.svg'
    const svgBuffer = fs.readFileSync(svgPath)
    
    // Create form data
    const formData = new FormData()
    formData.append('file', svgBuffer, {
      filename: 'test.svg',
      contentType: 'image/svg+xml'
    })
    
    // Add custom parameters
    formData.append('depth', '2')
    formData.append('size', '100')

    console.log('Sending SVG to API...')
    
    // Send request to API
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`)
    }

    // Get the JSON response with download link
    const result = await response.json()
    
    if (result.success) {
      // Download the STL file using the provided URL
      const downloadResponse = await fetch(result.downloadUrl)
      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.status}`)
      }
      
      const stlBuffer = await downloadResponse.buffer()
      const outputPath = 'output.stl'
      fs.writeFileSync(outputPath, stlBuffer)
      
      console.log(`✅ Successfully converted SVG to STL!`)
      console.log(`📁 STL file saved as: ${outputPath}`)
      console.log(`📊 File size: ${result.fileSize} bytes`)
      console.log(`🔢 Shapes processed: ${result.shapes}`)
      console.log(`📏 Parameters used: depth=${result.parameters.depth}, size=${result.parameters.size}`)
      console.log(`🔗 Download URL: ${result.downloadUrl}`)
    } else {
      throw new Error(result.error || 'Unknown error occurred')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Test health endpoint first
async function testHealth() {
  try {
    const response = await fetch('http://localhost:3001/api/health')
    const data = await response.json()
    console.log('🏥 Health check:', data)
    return true
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Testing SVG to STL API...')
  
  const isHealthy = await testHealth()
  if (!isHealthy) {
    console.log('Please make sure the API server is running on port 3001')
    return
  }
  
  await testSvgToStlConversion()
}

main()
