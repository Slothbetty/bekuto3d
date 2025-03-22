<script lang="ts" setup>
import type { Group, Mesh, Shape } from 'three'
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas } from '@tresjs/core'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

interface ShapeWithColor {
  shape: Shape
  color: Color
}

const groupRef = useTemplateRef<Group>('group')
const stlUrl = ref('')
const svgShapes = ref<ShapeWithColor[]>([])
const extrudeDepth = ref(10)

let exporter: STLExporter
const loader = new SVGLoader()

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    const svgData = e.target?.result as string
    const svgParsed = loader.parse(svgData)

    svgShapes.value = svgParsed.paths.map((path) => {
      const shapes = path.toShapes(true)
      // 获取 SVG 路径的颜色属性
      const color = path.color || '#FFA500' // 默认橙色
      return {
        shape: shapes[0],
        color,
      } as ShapeWithColor
    })
  }
  reader.readAsText(file)
}

function handelExportSTL() {
  const group = groupRef.value
  if (!group)
    return

  exporter ||= new STLExporter()
  const result = exporter.parse(group, {
    binary: false,
  })

  stlUrl.value = URL.createObjectURL(new Blob([result]))
}

const extrudeSettings = computed(() => ({
  depth: extrudeDepth.value,
  bevelEnabled: false,
}))

// 调整相机参数
const cameraPosition: [number, number, number] = [100, 100, 100]
const controlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0,
  maxDistance: 1000,
}
</script>

<template>
  <TresCanvas window-size clear-color="#82DBC5">
    <TresPerspectiveCamera
      :position="cameraPosition"
      :look-at="[0, 0, 0]"
    />
    <OrbitControls v-bind="controlsConfig" />
    <TresGroup v-if="svgShapes.length" ref="groupRef">
      <TresMesh
        v-for="(item, index) in svgShapes"
        :key="index"
      >
        <TresExtrudeGeometry
          :args="[item.shape, extrudeSettings]"
        />
        <TresMeshBasicMaterial :color="item.color" />
      </TresMesh>
    </TresGroup>
    <TresMesh v-else>
      <TresTorusGeometry :args="[10, 5, 16, 32]" />
      <TresMeshBasicMaterial color="orange" />
    </TresMesh>
    <TresAmbientLight :intensity="1" />
  </TresCanvas>
  <div left-10 top-10 fixed z-99 flex="~ col gap-4">
    <input
      type="file"
      accept=".svg"
      class="text-white"
      @change="handleFileSelect"
    >
    <div flex="~ gap-2" items-center>
      <label text-white>拉伸深度:</label>
      <input
        v-model="extrudeDepth"
        type="range"
        min="1"
        max="50"
      >
      <span text-white>{{ extrudeDepth }}</span>
    </div>
    <button text-xl text-white p2 rounded bg-blue @click="handelExportSTL">
      Export STL
    </button>
    <a
      v-if="stlUrl"
      :href="stlUrl"
      download="tres-test-model.stl"
      text-xl
      text-blue
    >
      Download The STL File
    </a>
  </div>
</template>
