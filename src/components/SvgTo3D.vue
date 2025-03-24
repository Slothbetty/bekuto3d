<!-- eslint-disable no-sequences -->
<script lang="ts" setup>
import type { Group, Shape } from 'three'
import { OrbitControls } from '@tresjs/cientos'
import { TresCanvas } from '@tresjs/core'
import { Box3, Color, Vector3 } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

interface ShapeWithColor {
  shape: Shape
  color: Color
  depth: number
  startZ: number // 添加起点Z轴位置
}

interface ModelSize {
  width: number
  height: number
  depth: number
}

const groupRef = useTemplateRef<Group>('group')
const modelGroup = computed(() => toRaw(groupRef.value))
const stlUrl = ref('')
const objUrl = ref('')
const gltfUrl = ref('')
const fileName = ref('')
const baseDepth = 2.1
const reliefDepth = 2
const svgShapes = ref<ShapeWithColor[]>([])
const scale = ref(0.074) // 添加缩放控制变量
const modelSize = ref<ModelSize>({ width: 0, height: 0, depth: 0 })
const modelOffset = ref({ x: 0, y: 0, z: 0 })

let stlExporter: STLExporter
let objExporter: OBJExporter
let gltfExporter: GLTFExporter
const loader = new SVGLoader()

function handleFileSelect(event: Event) {
  const inputEl = event.target as HTMLInputElement
  const file = inputEl.files?.[0]
  if (!file)
    return
  fileName.value = file.name
  inputEl.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    const svgData = e.target?.result as string
    const svgParsed = loader.parse(svgData)

    svgShapes.value = svgParsed.paths.map((path, index) => {
      // const isCW = ShapeUtils.isClockWise(path.subPaths[path.subPaths.length - 1].getPoints())
      // const isCW = ShapeUtils.isClockWise(path.subPaths[0].getPoints())
      // console.log('isCW:', isCW, 'all:', path.subPaths.map(i => ShapeUtils.isClockWise(i.getPoints())))

      const shapes = SVGLoader.createShapes(path)
      // 获取 SVG 路径的颜色属性
      const color = path.userData?.style?.fill || '#FFA500' // 默认橙色

      const shapesWithColor = shapes.map((shape) => {
        return {
          shape: markRaw(shape),
          color: markRaw(new Color().setStyle(color)),
          depth: index > 0 ? reliefDepth : baseDepth,
          startZ: index > 0 ? baseDepth : 0,
        } as ShapeWithColor
      })

      return shapesWithColor
    }).flat(1)
  }
  reader.readAsText(file)
}

function updateDepth(index: number, depth: number) {
  if (svgShapes.value[index])
    svgShapes.value[index].depth = depth
}

// 添加更新startZ的函数
function updateStartZ(index: number, startZ: number) {
  if (svgShapes.value[index])
    svgShapes.value[index].startZ = startZ
}

function calculateModelSize() {
  const group = modelGroup.value
  if (!group)
    return

  // 延迟执行以确保模型已渲染
  nextTick(() => {
    try {
      const box = (new Box3()).setFromObject(group, true)
      const size = new Vector3()
      box.getSize(size)

      modelOffset.value = {
        x: size.x / scale.value / -2,
        y: size.y / scale.value / -2,
        z: 0,
      }

      modelSize.value = {
        width: Number(size.x.toFixed(2)),
        height: Number(size.y.toFixed(2)),
        depth: Number(size.z.toFixed(2)),
      }
    }
    catch (error) {
      console.error('计算模型尺寸失败:', error)
    }
  })
}

function calcScale(nowScale: number, nowSize: number, targetSize: number) {
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
watch([() => groupRef.value, scale, () => svgShapes.value.map(i => [i.depth, i.startZ])], () => {
  calculateModelSize()
})

function handleExportSTL() {
  const group = modelGroup.value
  if (!group)
    return

  stlExporter ||= new STLExporter()
  const result = stlExporter.parse(group, {
    binary: true,
  })

  stlUrl.value = URL.createObjectURL(new Blob([result], { type: 'application/octet-stream' }))
}

function handleExportOBJ() {
  const group = modelGroup.value
  if (!group)
    return

  objExporter ||= new OBJExporter()
  const result = objExporter.parse(group)

  objUrl.value = URL.createObjectURL(new Blob([result], { type: 'text/plain' }))
}

function handleExportGLTF() {
  const group = modelGroup.value
  if (!group)
    return

  gltfExporter ||= new GLTFExporter()
  gltfExporter.parse(group, (result) => {
    gltfUrl.value = URL.createObjectURL(new Blob([result as ArrayBuffer], { type: 'application/octet-stream' }))
  }, (error) => {
    console.error('导出 GLTF 失败:', error)
  }, {
    binary: true,
  })
}

// 调整相机参数
const cameraPosition: [number, number, number] = [-50, 50, 100]
const controlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0,
  maxDistance: 1000,
}

// 添加材质相关参数
const materialConfig = {
  shininess: 100, // 增加高光度
  specular: '#ffffffd0', // 添加镜面反射颜色
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
      :scale="[scale, -scale, 1]"
    >
      <TresMesh
        v-for="(item, index) in svgShapes.filter(i => i.depth)"
        :key="index"
        :position="[modelOffset.x, modelOffset.y, modelOffset.z + item.startZ]"
      >
        <TresExtrudeGeometry
          :args="[item.shape, {
            depth: item.depth,
            bevelEnabled: false,
          }]"
        />
        <TresMeshPhongMaterial
          :color="item.color"
          v-bind="materialConfig"
        />
      </TresMesh>
    </TresGroup>
    <TresMesh v-else>
      <TresTorusGeometry :args="[10, 5, 16, 32]" />
      <TresMeshPhongMaterial
        color="orange"
        v-bind="materialConfig"
      />
    </TresMesh>

    <!-- 重新设计的光照系统 -->
    <!-- 主光源：从右上方打光 -->
    <TresDirectionalLight
      :position="[100, 100, 50]"
      :intensity="0.8"
    />
    <!-- 侧面补光：从左侧打光 -->
    <TresDirectionalLight
      :position="[-50, 20, 50]"
      :intensity="0.4"
    />
    <!-- 正面补光：轻微的正面打光 -->
    <TresDirectionalLight
      :position="[0, 0, 100]"
      :intensity="0.3"
    />
    <!-- 柔和的环境光 -->
    <TresAmbientLight :intensity="0.4" />
    <!-- 半球光：提供更自然的环境光照 -->
    <TresHemisphereLight
      :args="['#ffffff', '#4444ff', 0.5]"
      :position="[0, 100, 0]"
    />
  </TresCanvas>
  <div flex="~ col gap-6" p4 rounded-4 bg-white:50 max-w-340px w-full left-10 top-10 fixed z-999 of-y-auto backdrop-blur-md dark:bg-black:50 max-h="[calc(100vh-160px)]">
    <label flex="~ items-center" p2 border rounded cursor-pointer relative bg="black/10 dark:white/20 hover:black/20 dark:hover:white/30" title="Select SVG File">
      <input
        type="file"
        accept=".svg"
        class="op0 inset-0 absolute z--1"
        @change="handleFileSelect"
      >
      <template v-if="fileName">
        <span i-carbon:document mr-2 inline-block />
        <span>{{ fileName }}</span>
      </template>
      <template v-else>
        <span i-carbon:document-add mr-2 inline-block />
        <span>SVG</span>
      </template>
    </label>
    <template v-if="svgShapes.length">
      <div flex="~ gap-2 items-center">
        <label i-iconoir-scale-frame-enlarge inline-block />
        <input
          v-model.lazy.number="size"
          type="number"
          class="px-1 border-b w-20 inline-block"
        >
        <div flex-1 />
        <div>unit: <span text-blue>mm</span></div>
      </div>
      <div flex="~ col gap-4">
        <div
          v-for="(item, index) in svgShapes"
          :key="index"
          flex="~ gap-4"
        >
          <div flex="~ gap-2 items-center" :title="`Shape ${index + 1}`">
            <div
              class="border rounded h-5 min-h-5 min-w-5 w-5"
              :style="{ background: `#${item.color.getHexString()}` }"
            />
            <pre>{{ index + 1 }}</pre>
          </div>
          <div flex="~ gap-2 items-center" title="起点位置">
            <label i-iconoir-position inline-block />
            <input
              type="number"
              min="-10"
              step="0.1"
              max="10"
              :value="item.startZ"
              class="px-1 border-b w-20 inline-block"
              @change="e => updateStartZ(index, +(e.target as HTMLInputElement).value)"
            >
          </div>
          <div flex="~ gap-2 items-center" title="拉伸深度">
            <label i-iconoir-extrude inline-block />
            <input
              type="number"
              min="0"
              step="0.1"
              max="10"
              :value="item.depth"
              class="px-1 border-b w-20 inline-block"
              @change="e => updateDepth(index, +(e.target as HTMLInputElement).value)"
            >
          </div>
        </div>
      </div>
      <div v-if="modelSize.width" flex="~ gap-2 text-sm items-center" title="Size">
        <div i-iconoir-ruler-combine />
        <div>W: {{ modelSize.width }}mm</div>
        <div>H: {{ modelSize.height }}mm</div>
        <div>L: {{ modelSize.depth }}mm</div>
      </div>
      <div flex="~ col gap-2">
        <h2 text-lg flex="~ items-center gap-2">
          <div i-iconoir-floppy-disk-arrow-in />
          Export
        </h2>
        <div v-if="!(stlUrl || objUrl || gltfUrl)" flex="~ gap-2">
          <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportSTL">
            STL
          </button>
          <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportOBJ">
            OBJ
          </button>
          <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportGLTF">
            GLTF
          </button>
        </div>
        <div v-else flex="~ gap-2" text-white>
          <a
            v-if="stlUrl"
            class="text-xl p2 text-center rounded bg-blue flex-1 w-full block"
            :href="stlUrl"
            :download="`${fileName}.stl`"
            @click="stlUrl = ''"
          >
            Download The STL File
          </a>
          <a
            v-if="objUrl"
            class="text-xl p2 text-center rounded bg-blue flex-1 w-full block"
            :href="objUrl"
            :download="`${fileName}.obj`"
            @click="objUrl = ''"
          >
            Download The OBJ File
          </a>
          <a
            v-if="gltfUrl"
            class="text-xl p2 text-center rounded bg-blue flex-1 w-full block"
            :href="gltfUrl"
            :download="`${fileName}.gltf`"
            @click="gltfUrl = ''"
          >
            Download The GLTF File
          </a>
          <button title="close" text-xl p2 rounded bg-gray cursor-pointer @click="() => { stlUrl = ''; objUrl = ''; gltfUrl = '' }">
            <div i-carbon:close />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
