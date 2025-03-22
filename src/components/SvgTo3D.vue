<script lang="ts" setup>
import type { Mesh, Shape } from 'three'
import { TresCanvas } from '@tresjs/core'
import { ExtrudeGeometry, ShapeGeometry } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

const meshRef = useTemplateRef<Mesh>('mesh')
const stlUrl = ref('')
const svgPaths = ref<Shape[]>([])
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

    svgPaths.value = svgParsed.paths.map((path) => {
      const shapes = path.toShapes(true)
      return shapes[0]
    })
  }
  reader.readAsText(file)
}

function handelExportSTL() {
  const mesh = meshRef.value
  if (!mesh) {
    return
  }
  exporter ||= new STLExporter()
  const result = exporter.parse(mesh, {
    binary: false,

  })

  stlUrl.value = URL.createObjectURL(new Blob([result]))
}

const extrudeSettings = computed(() => ({
  depth: extrudeDepth.value,
  bevelEnabled: false,
}))

const size = 20
</script>

<template>
  <TresCanvas window-size clear-color="#82DBC5">
    <TresPerspectiveCamera
      :position="[3 * size, 3 * size, 3 * size]"
      :look-at="[0, 0, 0]"
    />
    <TresMesh v-if="svgPaths.length" ref="mesh">
      <TresExtrudeGeometry
        :args="[svgPaths[0], extrudeSettings]"
      />
      <TresMeshBasicMaterial color="orange" />
    </TresMesh>
    <TresMesh v-else>
      <TresTorusGeometry :args="[1 * size, 0.5 * size, 16, 32]" />
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
