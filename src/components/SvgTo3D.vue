<script lang="ts" setup>
import type { Group } from 'three'
import type { ShapeWithColor } from '../composables/useSvgLoader'
import { Box3, Vector3 } from 'three'
import { useSvgLoader } from '../composables/useSvgLoader'
import FileDropZone from './FileDropZone.vue'
import ModelExporter from './ModelExporter.vue'
import ModelRenderer from './ModelRenderer.vue'

interface ModelSize {
  width: number
  height: number
  depth: number
}

// 默认值
const defaultDepth = 2
const defaultSize = 37
const curveSegments = ref(64) // 模型曲线部分的细分程度

// 组件状态
const groupRef = useTemplateRef<Group>('group')
const fileName = ref('')
const svgShapes = ref<ShapeWithColor[]>([])
const scale = ref(1)
const modelSize = ref<ModelSize>({ width: 0, height: 0, depth: 0 })
const modelOffset = ref({ x: 0, y: 0, z: 0 })
const modelRendererRef = ref<InstanceType<typeof ModelRenderer>>()

// 默认模型信息
const DEFAULT_SVG = '/model/bekuto3d.svg'
const isDefaultSvg = computed(() => fileName.value === 'default-bekuto3d.svg')
const defaultSvgOffsetList = [0, 2.1]
const defaultSvgDepthList = [2.1, 0, 1, 1, 1, 2, 1, 1.4, 1.6]

const { createShapesWithColor } = useSvgLoader()

const modelGroup = computed(() => modelRendererRef.value?.modelGroup ?? null)
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

function mountSVG(svgData: string, customShapes?: (shapes: ShapeWithColor[], index: number) => ShapeWithColor[]) {
  svgShapes.value = createShapesWithColor(svgData, {
    defaultDepth,
    defaultStartZ: 0,
    customShapes,
  })

  nextTick(async () => {
    await nextTick()
    size.value = defaultSize
  })
}

function readFileAndConvert(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const svgData = e.target?.result as string
    mountSVG(svgData)
  }
  reader.readAsText(file)
}

async function loadDefaultSvg() {
  try {
    const response = await fetch(DEFAULT_SVG)
    const svgData = await response.text()
    fileName.value = 'default-bekuto3d.svg'

    mountSVG(svgData, (shapes, _) => shapes.map((item, index) => {
      item.startZ = defaultSvgOffsetList[index] ?? defaultSvgOffsetList[defaultSvgOffsetList.length - 1] ?? 0
      item.depth = defaultSvgDepthList[index] ?? 2
      return item
    }))
  }
  catch (error) {
    console.error('加载默认 SVG 失败:', error)
  }
}

function handleFileSelected(files: File[]) {
  if (files.length === 0)
    return
  fileName.value = files[0].name
  readFileAndConvert(files[0])
}

// 组件加载时自动加载默认文件
onMounted(() => {
  loadDefaultSvg()
})

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

function updateDepth(index: number, depth: number) {
  if (svgShapes.value[index])
    svgShapes.value[index].depth = depth
}

// 添加更新startZ的函数
function updateStartZ(index: number, startZ: number) {
  if (svgShapes.value[index])
    svgShapes.value[index].startZ = startZ
}

// 监听 group 和 scale 的变化
watch([() => groupRef.value, scale, () => svgShapes.value.map(i => [i.depth, i.startZ])], () => {
  calculateModelSize()
})

// 调整相机参数
const cameraPosition: [number, number, number] = [-50, 50, 100]
const controlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0,
  maxDistance: 1000,
}

// 添加材质相关参数
const materialConfig = ref({
  shininess: 100, // 增加高光度
  specular: '#ffffffd0', // 添加镜面反射颜色
  transparent: true,
  wireframe: false,
})
</script>

<template>
  <ModelRenderer
    ref="modelRendererRef"
    v-model:model-size="modelSize"
    v-model:model-offset="modelOffset"
    :shapes="svgShapes"
    :scale="scale"
    :curve-segments="curveSegments"
    :material-config="materialConfig"
    :camera-position="cameraPosition"
    :controls-config="controlsConfig"
    @model-loaded="() => {}"
  />
  <div flex="~ col gap-6" p4 rounded-4 bg-white:50 max-w-340px w-full left-10 top-10 fixed z-999 of-y-auto backdrop-blur-md dark:bg-black:50 max-h="[calc(100vh-160px)]">
    <div flex="~ col gap-2">
      <div flex="~ gap-3 items-center" text-xl font-500>
        <img src="/logo-dark.svg" size-7.5 class="hidden dark:block">
        <img src="/logo-light.svg" size-7.5 class="block dark:hidden">
        <h1>Bekuto 3D</h1>
      </div>
      <p op-80>
        Convert SVG files to 3D models
      </p>
    </div>
    <FileDropZone
      v-model:filename="fileName"
      :accept="['image/svg+xml']"
      :default-text="isDefaultSvg ? 'Click or drop SVG file' : undefined"
      @file-selected="handleFileSelected"
    />
    <template v-if="svgShapes.length && !isDefaultSvg">
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
            <pre min-w-5>{{ index + 1 }}</pre>
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
        <div>W: {{ modelSize.width }}</div>
        <div>H: {{ modelSize.height }}</div>
        <div>L: {{ modelSize.depth }}</div>
      </div>
      <ModelExporter
        :model-group="modelGroup"
        :file-name="fileName"
      />
    </template>
  </div>
</template>
