import type { Group, Mesh, MeshPhongMaterial, Object3D } from 'three'
import { XMLBuilder } from 'fast-xml-parser'
import JSZip from 'jszip'
import { Color, Vector3 } from 'three'

/**
 * 组件信息接口
 */
interface ComponentInfo {
  id: number
  vertices: { x: number, y: number, z: number }[]
  triangles: { v1: number, v2: number, v3: number }[]
  material: MaterialInfo | null
  name: string
}

/**
 * 材质信息接口，用于存储颜色数据
 */
interface MaterialInfo {
  id: number
  color: Color
  name: string
  extruder: number
}

/**
 * 将 Three.js 的 Group 或 Mesh 导出为 3MF 文件格式 (BambuStudio 兼容格式)
 * @param object Three.js Group 对象或 Mesh 数组
 * @returns Blob 数据
 */
export async function exportTo3MF(object: Group | Object3D): Promise<Blob> {
  const zip = new JSZip()

  // 收集所有组件和材质信息
  const components: ComponentInfo[] = []
  const materials: MaterialInfo[] = []

  // 递归处理所有网格
  collectComponents(object, components, materials)

  // 创建 3MF 所需的基本文件结构
  const mainModelXml = createMainModelXML(components)
  const objectModelXml = createObjectModelXML(components)
  const modelSettingsXml = createModelSettingsXML(components)
  const projectSettingsConfig = createProjectSettingsConfig(materials)

  // 将文件添加到ZIP中
  zip.file('[Content_Types].xml', contentTypesXML())
  zip.file('_rels/.rels', relationshipsXML())
  zip.file('3D/3dmodel.model', mainModelXml)
  zip.file('3D/_rels/3dmodel.model.rels', objectRelationshipsXML())
  zip.file('3D/Objects/object-97.model', objectModelXml)
  zip.file('Metadata/model_settings.config', modelSettingsXml)
  zip.file('Metadata/project_settings.config', projectSettingsConfig)

  // 生成ZIP文件
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' })
}

/**
 * 收集模型中的组件和材质信息
 */
function collectComponents(
  object: Object3D,
  components: ComponentInfo[],
  materials: MaterialInfo[],
): void {
  object.updateMatrixWorld(true)

  // 处理网格
  if (object.type === 'Mesh') {
    const mesh = object as Mesh
    const geometry = mesh.geometry
    const positionAttr = geometry.attributes.position
    const indexAttr = geometry.index

    // 处理材质
    let materialInfo: MaterialInfo | null = null
    if (mesh.material) {
      // 获取材质颜色
      const color = new Color()
      if ('color' in mesh.material && mesh.material.color) {
        color.copy((mesh.material as MeshPhongMaterial).color)
      }
      else {
        // 默认颜色为灰色
        color.set(0x808080)
      }

      // 检查是否已存在相同颜色的材质
      const existingMaterial = materials.find(m =>
        m.color.r === color.r && m.color.g === color.g && m.color.b === color.b,
      )

      if (existingMaterial) {
        materialInfo = existingMaterial
      }
      else {
        const extruder = materials.length + 1 // 挤出头编号从1开始
        materialInfo = {
          id: materials.length,
          color,
          name: mesh.name ? `${mesh.name}_material` : `material_${materials.length}`,
          extruder,
        }
        materials.push(materialInfo)
      }
    }

    // 创建新组件
    const componentId = 100 + components.length
    const component: ComponentInfo = {
      id: componentId,
      vertices: [],
      triangles: [],
      material: materialInfo,
      name: mesh.name || `Default-${componentId}`,
    }

    // 处理顶点
    const worldMatrix = mesh.matrixWorld
    for (let i = 0; i < positionAttr.count; i++) {
      const vertex = new Vector3()
      vertex.fromBufferAttribute(positionAttr, i)
      vertex.applyMatrix4(worldMatrix)
      component.vertices.push({
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
      })
    }

    // 处理三角形
    if (indexAttr) {
      // 有索引的几何体
      for (let i = 0; i < indexAttr.count; i += 3) {
        component.triangles.push({
          v1: indexAttr.getX(i),
          v2: indexAttr.getX(i + 1),
          v3: indexAttr.getX(i + 2),
        })
      }
    }
    else {
      // 无索引的几何体
      for (let i = 0; i < positionAttr.count; i += 3) {
        component.triangles.push({
          v1: i,
          v2: i + 1,
          v3: i + 2,
        })
      }
    }

    components.push(component)
  }

  // 递归处理子对象
  object.children.forEach((child) => {
    collectComponents(child, components, materials)
  })
}

/**
 * 创建主3dmodel.model文件的XML数据
 */
function createMainModelXML(components: ComponentInfo[]): string {
  const model = {
    model: {
      '@_unit': 'millimeter',
      '@_xml:lang': 'en-US',
      '@_xmlns': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02',
      '@_xmlns:slic3rpe': 'http://schemas.slic3r.org/3mf/2017/06',
      '@_xmlns:p': 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06',
      '@_requiredextensions': 'p',
      'metadata': [
        { '@_name': 'Application', '#text': 'BambuStudio-01.07.04.52' },
        { '@_name': 'Title', '#text': 'Exported 3D Model' },
        { '@_name': 'CreationDate', '#text': new Date().toString() },
        { '@_name': 'Copyright', '#text': 'Copyright (c) 2023. All rights reserved.' },
      ],
      'resources': {
        object: {
          '@_id': '97',
          '@_p:uuid': generateUUID(),
          '@_type': 'model',
          'components': {
            component: components.map(comp => ({
              '@_p:path': '/3D/Objects/object-97.model',
              '@_objectid': comp.id.toString(),
            })),
          },
        },
      },
      'build': {
        '@_p:uuid': `${generateUUID()}1`,
        'item': {
          '@_objectid': '97',
          '@_p:uuid': `${generateUUID()}2`,
          '@_transform': '1 0 0 0 1 0 0 0 1 0 0 0',
          '@_printable': '1',
        },
      },
    },
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
 * 创建对象模型XML数据
 */
function createObjectModelXML(components: ComponentInfo[]): string {
  const objects = components.map((component) => {
    return {
      object: {
        '@_id': component.id.toString(),
        '@_p:uuid': generateUUID(),
        '@_type': 'model',
        'mesh': {
          vertices: {
            vertex: component.vertices.map(v => ({
              '@_x': v.x.toFixed(7),
              '@_y': v.y.toFixed(7),
              '@_z': v.z.toFixed(7),
            })),
          },
          triangles: {
            triangle: component.triangles.map(t => ({
              '@_v1': t.v1,
              '@_v2': t.v2,
              '@_v3': t.v3,
            })),
          },
        },
      },
    }
  })

  const model = {
    model: {
      '@_unit': 'millimeter',
      '@_xml:lang': 'en-US',
      '@_xmlns': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02',
      '@_xmlns:p': 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06',
      'resources': objects,
    },
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
 * 创建模型设置XML配置
 */
function createModelSettingsXML(components: ComponentInfo[]): string {
  const partsXml = components.map((comp) => {
    const extruder = comp.material ? comp.material.extruder : 1
    return `    <part id="${comp.id}" subtype="normal_part">
      <metadata key="name" value="${comp.name}"/>
      <metadata key="extruder" value="${extruder}"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="97">
    <metadata key="name" value="Exported3DModel.3mf"/>
    <metadata key="extruder" value="1"/>
    <metadata key="thumbnail_file" value=""/>
${partsXml}
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="plate-1"/>
    <model_instance>
      <metadata key="object_id" value="97"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>
  <assemble>
    <assemble_item object_id="97" instance_id="0" offset="0 0 0"/>
  </assemble>
</config>`
}

/**
 * 创建项目设置配置文件
 */
function createProjectSettingsConfig(materials: MaterialInfo[]): string {
  // 从材质中提取颜色
  const colors = materials.map((m) => {
    return rgbToHexColor(m.color)
  })

  // 确保至少有两个颜色(BambuStudio的要求)
  while (colors.length < 2) {
    colors.push('#FFFFFF')
  }

  const projectSettings = {
    printable_area: ['0x0', '180x0', '180x180', '0x180'],
    printable_height: '180',
    bed_exclude_area: [],
    filament_colour: colors,
    filament_settings_id: Array.from({ length: colors.length }).fill('Bambu PLA Basic @BBL A1M'),
    filament_diameter: Array.from({ length: colors.length }).fill('1.75'),
    filament_is_support: Array.from({ length: colors.length }).fill('0'),
    printer_model: 'Bambu Lab A1 mini',
    layer_height: '0.2',
    wall_loops: '2',
    sparse_infill_density: '15%',
    printer_settings_id: 'Bambu Lab A1 mini 0.4 nozzle',
    printer_variant: '0.4',
    nozzle_diameter: ['0.4'],
    enable_support: '0',
    support_type: 'normal(auto)',
    print_settings_id: '0.20mm Standard',
  }

  return JSON.stringify(projectSettings)
}

/**
 * 创建 3MF ContentTypes XML
 */
function contentTypesXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>`
}

/**
 * 创建 3MF Relationships XML
 */
function relationshipsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel-1" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
}

/**
 * 创建对象关系XML
 */
function objectRelationshipsXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/Objects/object-97.model" Id="rel-97" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
}

/**
 * 将RGB颜色转换为十六进制颜色字符串
 */
function rgbToHexColor(color: Color): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * 生成简单的UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
