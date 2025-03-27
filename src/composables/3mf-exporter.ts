import type { Group, Mesh, MeshPhongMaterial, Object3D } from 'three'
import { XMLBuilder } from 'fast-xml-parser'
import JSZip from 'jszip'
import { Color, Vector3 } from 'three'

/**
 * 将 Three.js 的 Group 或 Mesh 导出为 3MF 文件格式
 * @param object Three.js Group 对象或 Mesh 数组
 * @returns Blob 数据
 */
export async function exportTo3MF(object: Group | Object3D): Promise<Blob> {
  const zip = new JSZip()

  // 创建 3MF 所需的基本文件结构
  const modelData = createModelXML(object)
  zip.file('[Content_Types].xml', contentTypesXML())
  zip.file('_rels/.rels', relationshipsXML())
  zip.file('3D/3dmodel.model', modelData)

  // 生成 ZIP 文件 (3MF 本质上是一个 ZIP 容器)
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' })
}

/**
 * 材质信息接口，用于存储颜色数据
 */
interface MaterialInfo {
  id: number
  color: Color
  name: string
}

/**
 * 创建 3MF 模型 XML 数据，将所有网格作为单个对象
 */
function createModelXML(object: Group | Object3D): string {
  // 收集所有顶点和三角形数据，合并为一个统一模型
  const vertices: { x: number, y: number, z: number }[] = []
  const triangles: { v1: number, v2: number, v3: number, pid?: number }[] = []
  const materials: MaterialInfo[] = []

  // 递归处理所有网格
  processObject(object, vertices, triangles, materials)

  // 构建 XML 数据
  const model = {
    model: {
      '@_unit': 'millimeter',
      '@_xmlns': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02',
      'resources': {
        // 定义材质资源
        basematerials: materials.length > 0
          ? {
              '@_id': '0',
              'base': materials.map(m => ({
                '@_name': m.name || `color_${m.id}`,
                '@_displaycolor': rgbToHexColor(m.color),
              })),
            }
          : undefined,
        object: {
          '@_id': '1',
          '@_type': 'model',
          'mesh': {
            vertices: {
              vertex: vertices.map(v => ({
                '@_x': v.x.toFixed(7),
                '@_y': v.y.toFixed(7),
                '@_z': v.z.toFixed(7),
              })),
            },
            triangles: {
              triangle: triangles.map(t => ({
                '@_v1': t.v1,
                '@_v2': t.v2,
                '@_v3': t.v3,
                ...(t.pid !== undefined ? { '@_pid': '0', '@_p1': t.pid } : {}),
              })),
            },
          },
        },
      },
      'build': {
        item: {
          '@_objectid': '1',
          '@_transform': '1 0 0 0 1 0 0 0 1 0 0 0',
        },
      },
    },
  }

  // 如果没有材质，删除空的 basematerials
  if (materials.length === 0 && model.model.resources.basematerials) {
    delete model.model.resources.basematerials
  }

  const builder = new XMLBuilder({
    attributeNamePrefix: '@_',
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(model)}`
}

/**
 * 将RGB颜色转换为十六进制颜色字符串
 */
function rgbToHexColor(color: Color): string {
  return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
}

/**
 * 递归处理对象及其子对象，收集顶点和三角形数据
 */
function processObject(
  object: Object3D,
  vertices: { x: number, y: number, z: number }[],
  triangles: { v1: number, v2: number, v3: number, pid?: number }[],
  materials: MaterialInfo[],
) {
  object.updateMatrixWorld(true)

  // 处理网格
  if (object.type === 'Mesh') {
    const mesh = object as Mesh
    const geometry = mesh.geometry
    const positionAttr = geometry.attributes.position
    const indexAttr = geometry.index
    const vertexOffset = vertices.length

    // 处理材质
    let materialId: number | undefined
    if (mesh.material) {
      // 检查是否已存在相同颜色的材质
      const color = new Color()
      if ('color' in mesh.material && mesh.material.color) {
        color.copy((mesh.material as MeshPhongMaterial).color)
      }
      else {
        // 默认颜色为灰色
        color.set(0x808080)
      }

      const existingMaterial = materials.find(m =>
        m.color.r === color.r && m.color.g === color.g && m.color.b === color.b,
      )

      if (existingMaterial) {
        materialId = existingMaterial.id
      }
      else {
        materialId = materials.length
        const materialName = mesh.name ? `${mesh.name}_material` : `material_${materialId}`
        materials.push({
          id: materialId,
          color,
          name: materialName,
        })
      }
    }

    // 处理顶点
    const worldMatrix = mesh.matrixWorld
    for (let i = 0; i < positionAttr.count; i++) {
      const vertex = new Vector3()
      vertex.fromBufferAttribute(positionAttr, i)
      vertex.applyMatrix4(worldMatrix)
      vertices.push({
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
      })
    }

    // 处理三角形
    if (indexAttr) {
      // 有索引的几何体
      for (let i = 0; i < indexAttr.count; i += 3) {
        triangles.push({
          v1: vertexOffset + indexAttr.getX(i),
          v2: vertexOffset + indexAttr.getX(i + 1),
          v3: vertexOffset + indexAttr.getX(i + 2),
          ...(materialId !== undefined ? { pid: materialId } : {}),
        })
      }
    }
    else {
      // 无索引的几何体
      for (let i = 0; i < positionAttr.count; i += 3) {
        triangles.push({
          v1: vertexOffset + i,
          v2: vertexOffset + i + 1,
          v3: vertexOffset + i + 2,
          ...(materialId !== undefined ? { pid: materialId } : {}),
        })
      }
    }
  }

  // 递归处理子对象
  object.children.forEach((child) => {
    processObject(child, vertices, triangles, materials)
  })
}

/**
 * 创建 3MF ContentTypes XML
 */
function contentTypesXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`
}

/**
 * 创建 3MF Relationships XML
 */
function relationshipsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`
}
