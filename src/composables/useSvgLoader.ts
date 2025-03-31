import type { Shape } from 'three'
import { Color } from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

export interface ShapeWithColor {
  shape: Shape
  color: Color
  opacity: number
  depth: number
  startZ: number
  polygonOffset: number
}

export function useSvgLoader() {
  const loader = new SVGLoader()

  function createShapesWithColor(svgData: string, options: {
    defaultColor?: string
    defaultDepth?: number
    defaultStartZ?: number
    customShapes?: (shapes: ShapeWithColor[], index: number) => ShapeWithColor[]
  } = {}) {
    const {
      defaultColor = '#FFA500',
      defaultDepth = 2,
      defaultStartZ = 0,
      customShapes,
    } = options

    const svgParsed = loader.parse(svgData)
    const shapes = svgParsed.paths.map((path) => {
      const pathShapes = SVGLoader.createShapes(path)
      const color = path.userData?.style?.fill || defaultColor
      const fillOpacity = path.userData?.style?.fillOpacity ?? 1

      return pathShapes.map((shape) => {
        return {
          shape: markRaw(shape),
          color: markRaw(new Color().setStyle(color)),
          startZ: defaultStartZ,
          depth: defaultDepth,
          opacity: fillOpacity,
          polygonOffset: 0,
        } as ShapeWithColor
      })
    }).flat(1)

    return customShapes ? customShapes(shapes, 0) : shapes
  }

  return {
    createShapesWithColor,
  }
}
