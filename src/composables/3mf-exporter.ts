import type { BufferGeometry, Color, Mesh } from 'three'
import JSZip from 'jszip'
import { MeshPhongMaterial, Vector3 } from 'three'

/**
 * 导出模型到 3MF 格式
 *
 * 使用示例：
 * ```
 * const meshes = [mesh1, mesh2, mesh3];  // 多个mesh对象的数组
 * exportToThreeMF(meshes);
 * ```
 * @param meshes
 */
export async function exportTo3MF(meshes: Mesh | Mesh[], scale = 1): Promise<Blob> {
  // 确保 meshes 是数组
  if (!Array.isArray(meshes)) {
    meshes = [meshes]
  }

  const zip = new JSZip()
  const xmlBuilder: string[] = []

  // 1. 收集和合并材质
  const materialMap = new Map<number, Color>() // 存储唯一的材质
  const meshMaterialIds = new Map<Mesh, number>() // 存储每个mesh对应的材质ID

  meshes.forEach((mesh) => {
    const material = mesh.material
    // 判断是不是 MeshPhongMaterial
    if (!(material instanceof MeshPhongMaterial)) {
      console.warn('Only MeshPhongMaterial is supported', material)
      // throw new TypeError('Only MeshPhongMaterial is supported')
      return
    }

    const color = material.color

    // 查找是否已存在相同颜色的材质
    let existingMaterialId = null
    for (const [id, existingColor] of materialMap.entries()) {
      if (colorsEqual(existingColor, color)) {
        existingMaterialId = id
        break
      }
    }

    if (existingMaterialId === null) {
      // 新材质
      const newId = materialMap.size + 1
      materialMap.set(newId, color)
      meshMaterialIds.set(mesh, newId)
    }
    else {
      // 使用已存在的材质
      meshMaterialIds.set(mesh, existingMaterialId)
    }
  })

  // 2. 开始构建 XML
  xmlBuilder.push(`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>`)

  // 3. 添加材质定义
  xmlBuilder.push('    <basematerials id="1">')
  for (const [id, color] of materialMap.entries()) {
    xmlBuilder.push(`      <base name="material_${id}" displaycolor="${colorToHex(color)}"/>`)
  }
  xmlBuilder.push('    </basematerials>')

  // 4. 添加所有mesh对象
  let objectId = 2 // 材质占用了id 1
  for (const mesh of meshes) {
    const geometry = mesh.geometry as BufferGeometry
    const positions = geometry.getAttribute('position')
    const materialId = meshMaterialIds.get(mesh) || 0

    // 获取世界变换矩阵
    mesh.updateWorldMatrix(true, false)
    const worldMatrix = mesh.matrixWorld

    xmlBuilder.push(`    <object id="${objectId}" type="model" pid="1" pindex="${materialId - 1}">
      <mesh>`)

    // 添加顶点
    xmlBuilder.push('        <vertices>')
    for (let i = 0; i < positions.count; i++) {
      // 获取顶点位置
      const vertex = new Vector3()
      vertex.fromBufferAttribute(positions, i)
      // 应用世界变换
      vertex.applyMatrix4(worldMatrix)

      // 转换单位
      const x = vertex.x * scale
      const y = vertex.y * scale
      const z = vertex.z * scale

      xmlBuilder.push(`          <vertex x="${x.toFixed(6)}" y="${y.toFixed(6)}" z="${z.toFixed(6)}"/>`)
    }
    xmlBuilder.push('        </vertices>')

    // 添加三角面
    xmlBuilder.push('        <triangles>')

    // 检查是否有索引
    const indices = geometry.index
    if (indices !== null) {
      // 有索引的情况
      for (let i = 0; i < indices.count; i += 3) {
        const v1 = indices.getX(i)
        const v2 = indices.getX(i + 1)
        const v3 = indices.getX(i + 2)
        xmlBuilder.push(`          <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`)
      }
    }
    else {
      // 没有索引的情况，直接使用顶点序号
      for (let i = 0; i < positions.count; i += 3) {
        const v1 = i
        const v2 = i + 1
        const v3 = i + 2
        xmlBuilder.push(`          <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`)
      }
    }

    xmlBuilder.push('        </triangles>')

    xmlBuilder.push('      </mesh>')
    xmlBuilder.push('    </object>')

    objectId++
  }

  // 5. 添加构建信息
  xmlBuilder.push('  </resources>')
  xmlBuilder.push('  <build>')

  // 为每个对象添加构建项
  for (let i = 2; i < objectId; i++) {
    xmlBuilder.push(`    <item objectid="${i}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`)
  }

  xmlBuilder.push('  </build>')
  xmlBuilder.push('</model>')

  // 6. 添加必需的文件到 ZIP
  // 添加主模型文件
  zip.file('3D/3dmodel.model', xmlBuilder.join('\n'))

  // 添加 Content_Types.xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`)

  // 添加 .rels 文件
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`)

  // 7. 生成并下载文件
  const blob = await zip.generateAsync({ type: 'blob' })

  return blob
}

// 辅助函数：转换 Three.js Color 为 hex 字符串
function colorToHex(color: Color): string {
  return `#${color.getHexString()}`
}

// 辅助函数：比较两个颜色是否相同
function colorsEqual(color1: Color, color2: Color): boolean {
  return color1.getHexString() === color2.getHexString()
}
