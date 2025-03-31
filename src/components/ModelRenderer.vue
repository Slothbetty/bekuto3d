<script lang="ts" setup>
import type { Color, Group, Shape } from 'three'
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas } from '@tresjs/core'
import { Box3, Vector3 } from 'three'

interface ShapeWithColor {
  shape: Shape
  color: Color
  opacity: number
  depth: number
  startZ: number
  polygonOffset: number
}

interface ModelSize {
  width: number
  height: number
  depth: number
}

interface ModelOffset {
  x: number
  y: number
  z: number
}

interface MaterialConfig {
  shininess: number
  specular?: string
  transparent: boolean
  wireframe: boolean
}

interface ControlsConfig {
  enableDamping: boolean
  dampingFactor: number
  minDistance: number
  maxDistance: number
}

const props = defineProps<{
  shapes: ShapeWithColor[]
  modelSize: ModelSize
  modelOffset: ModelOffset
  scale: number
  curveSegments: number
  materialConfig: MaterialConfig
  cameraPosition: [number, number, number]
  controlsConfig: ControlsConfig
}>()

const emit = defineEmits<{
  (e: 'update:modelSize', size: ModelSize): void
  (e: 'update:modelOffset', offset: ModelOffset): void
  (e: 'modelLoaded'): void
}>()

const groupRef = useTemplateRef<Group>('group')
const modelGroup = computed(() => toRaw(groupRef.value))

/**
 * 解决 Z-fighting 问题
 * 通过微调深度值来解决拉伸方向上面重叠时的闪烁问题
 * @param shapes
 * @param scale
 */
function suppressZFighting(shapes: ShapeWithColor[], scale = 0.001) {
  const depths = new Map<number, number>()
  const offsets = new Map<number, number>()

  return shapes.map((shape) => {
    if (!shape.depth)
      return shape

    const offset = shape.startZ
    let offsetCount = 0

    if (offsetCount = offsets.get(offset) || 0) {
      const newOffset = fixFloat(offsetCount * scale)
      shape = {
        ...shape,
        depth: fixFloat(shape.depth + newOffset),
        startZ: fixFloat(shape.startZ - newOffset),
      }
    }

    offsets.set(offset, offsetCount + 1)
    return shape
  }).map((shape) => {
    if (!shape.depth)
      return shape

    const depth = fixFloat(shape.startZ + shape.depth)
    let depthCount = 0

    if (depthCount = depths.get(depth) || 0) {
      shape = {
        ...shape,
        depth: fixFloat(shape.depth + depthCount * scale),
      }
    }
    depths.set(depth, depthCount + 1)
    return shape
  })
}

function fixFloat(num: number) {
  return Number.parseFloat(num.toFixed(10))
}

// 计算实际显示的形状
const shownShapes = computed(() => suppressZFighting(props.shapes).filter(i => i.depth))

// 监听模型变化并更新尺寸
watch([() => groupRef.value, () => props.scale, () => props.shapes.map(i => [i.depth, i.startZ])], () => {
  calculateModelSize()
})

function calculateModelSize() {
  const group = modelGroup.value
  if (!group)
    return

  nextTick(() => {
    try {
      const box = (new Box3()).setFromObject(group, true)
      const size = new Vector3()
      box.getSize(size)

      const newOffset = {
        x: size.x / props.scale / -2,
        y: size.y / props.scale / -2,
        z: 0,
      }

      const newSize = {
        width: Number(size.x.toFixed(2)),
        height: Number(size.y.toFixed(2)),
        depth: Number(size.z.toFixed(2)),
      }

      emit('update:modelOffset', newOffset)
      emit('update:modelSize', newSize)
      emit('modelLoaded')
    }
    catch (error) {
      console.error('计算模型尺寸失败:', error)
    }
  })
}

// 暴露方法给父组件
defineExpose({
  modelGroup,
})
</script>

<template>
  <TresCanvas window-size :clear-color="isDark ? '#437568' : '#82DBC5'" :logarithmic-depth-buffer="true">
    <TresPerspectiveCamera
      :position="cameraPosition"
      :look-at="[0, 0, 0]"
    />
    <OrbitControls v-bind="controlsConfig" />
    <TresGroup
      v-if="shapes.length"
      ref="group"
      :scale="[scale, -scale, 1]"
    >
      <TresMesh
        v-for="(item, index) in shownShapes"
        :key="index"
        :position="[modelOffset.x, modelOffset.y, modelOffset.z + item.startZ]"
        :render-order="index + 1"
      >
        <TresExtrudeGeometry
          :args="[item.shape, {
            depth: item.depth,
            bevelEnabled: false,
            curveSegments,
          }]"
        />
        <TresMeshPhongMaterial
          v-bind="materialConfig"
          :color="item.color"
          :opacity="item.opacity"
          :polygon-offset="!!item.polygonOffset"
          :polygon-offset-factor="item.polygonOffset"
        />
      </TresMesh>
    </TresGroup>

    <!-- 光照系统 -->
    <TresDirectionalLight
      :position="[100, 100, 50]"
      :intensity="1"
    />
    <TresDirectionalLight
      :position="[-50, 20, 50]"
      :intensity="0.4"
    />
    <TresDirectionalLight
      :position="[0, 0, 100]"
      :intensity="0.5"
    />
    <TresAmbientLight :intensity="0.4" />
    <TresHemisphereLight
      :args="['#ffffff', '#4444ff', 0.5]"
      :position="[0, 100, 0]"
    />
  </TresCanvas>
</template>
