<script lang="ts" setup>
import type { Color, Group, Shape } from 'three'
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas } from '@tresjs/core'
import { Box3, ShapeUtils, Vector3 } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

interface ShapeWithColor {
  shape: Shape
  color: Color
  depth: number
}

interface ModelSize {
  width: number
  height: number
  depth: number
}

const groupRef = useTemplateRef<Group>('group')
const modelGroup = computed(() => toRaw(groupRef.value))
const stlUrl = ref('')
const baseDepth = 2.1
const reliefDepth = baseDepth+2
const svgShapes = ref<ShapeWithColor[]>([])
const scale = ref(0.074) // 添加缩放控制变量
const modelSize = ref<ModelSize>({ width: 0, height: 0, depth: 0 })

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

    svgShapes.value = svgParsed.paths.map((path,index) => {
      const shapes = path.toShapes(ShapeUtils.isClockWise(path.subPaths[path.subPaths.length-1].getPoints()))
      // 获取 SVG 路径的颜色属性
      const color = path.color || '#FFA500' // 默认橙色
      return {
        shape: markRaw(shapes[0]),
        color: markRaw(color),
        depth: index > 0 ? reliefDepth : baseDepth,
      } as ShapeWithColor
    })
  }
  reader.readAsText(file)
}

function updateDepth(index: number, depth: number) {
  if (svgShapes.value[index])
    svgShapes.value[index].depth = depth
}

function updateScale(value: number) {
  scale.value = value
}

function calculateModelSize() {
  const group = modelGroup.value
  if (!group)
    return

  // 延迟执行以确保模型已渲染
  setTimeout(() => {
    try {
      const box = (new Box3()).setFromObject(group, true)
      const size = new Vector3()
      box.getSize(size)

      modelSize.value = {
        width: Number(size.x.toFixed(2)),
        height: Number(size.y.toFixed(2)),
        depth: Number(size.z.toFixed(2)),
      }
    }
    catch (error) {
      console.error('计算模型尺寸失败:', error)
    }
  }, 100)
}

function calcScale(nowScale: number, nowSize: number, targetSize: number) {
  // 100/(37/0.074)
  return targetSize / (nowSize / nowScale)
}

const size = computed({
  get() {
    if (svgShapes.value.length === 0)
      return 0
    return modelSize.value.width
  },
  set(value) {
    if (svgShapes.value.length === 0)
      return
    scale.value = calcScale(scale.value, modelSize.value.width, value)
  },
})

// 监听 group 和 scale 的变化
watch([() => groupRef.value, scale], () => {
  calculateModelSize()
})

function handelExportSTL() {
  const group = modelGroup.value
  if (!group)
    return

  exporter ||= new STLExporter()
  const result = exporter.parse(group, {
    binary: false,
  })

  stlUrl.value = URL.createObjectURL(new Blob([result]))
}

// 调整相机参数
const cameraPosition: [number, number, number] = [-50, 50, -100]
const controlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0,
  maxDistance: 1000,
}
</script>

<template>
  <TresCanvas window-size :clear-color="isDark ? '#437568' : '#82DBC5'">
    <TresPerspectiveCamera
      :position="cameraPosition"
      :look-at="[0, 0, 0]"
    />
    <OrbitControls v-bind="controlsConfig" />
    <TresGroup
      v-if="svgShapes.length"
      ref="group"
      :scale="[-scale, -scale, -1]"
    >
      <TresMesh
        v-for="(item, index) in svgShapes"
        :key="index"
      >
        <TresExtrudeGeometry
          :args="[item.shape, {
            depth: item.depth,
          }]"
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
  <div flex="~ col gap-4" p4 rounded-4 bg-white:50 max-w-340px w-full left-10 top-10 fixed z-999 backdrop-blur-md dark:bg-black:50>
    <label p2 border rounded bg-white:20 flex="~ items-center" relative>
      <input
        type="file"
        accept=".svg"
        class="op0 inset-0 absolute"
        @change="handleFileSelect"
      >
      <span i-carbon:document-add mr-2 inline-block />
      <span>SVG</span>
    </label>
    <template v-if="svgShapes.length">
      <div flex="~ gap-2" items-center>
        <label text-white>宽度</label>
        <input
          type="number"
          v-model.lazy.number="size"
        >
      </div>
      <div flex="~ gap-2" items-center>
        <label text-white>整体缩放:</label>
        <input
          type="range"
          min="0.1"
          step="0.1"
          max="5"
          :value="scale"
          @input="e => updateScale(+(e.target as HTMLInputElement).value)"
        >
        <span text-white>{{ scale.toFixed(4) }}</span>
      </div>
      <div
        v-for="(item, index) in svgShapes"
        :key="index"
        flex="~ gap-2"
        items-center
      >
        <div
          class="rounded h-4 w-4"
          :style="{ background: `#${item.color.getHexString()}` }"
        />
        <label text-white>形状 {{ index + 1 }} 拉伸深度:</label>
        <input
          type="range"
          min="0.1"
          step="0.1"
          max="10"
          :value="item.depth"
          @input="e => updateDepth(index, +(e.target as HTMLInputElement).value)"
        >
        <span text-white>{{ item.depth }}</span>
      </div>
      <div v-if="modelSize.width" flex="~ col gap-2" text-white>
        <div>模型尺寸:</div>
        <div>宽度: {{ modelSize.width }}mm</div>
        <div>高度: {{ modelSize.height }}mm</div>
        <div>深度: {{ modelSize.depth }}mm</div>
      </div>
    </template>
    <button v-if="svgShapes.length" text-xl text-white p2 rounded bg-blue @click="handelExportSTL">
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
