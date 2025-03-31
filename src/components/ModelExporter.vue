<script lang="ts" setup>
import type { Group } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { exportTo3MF } from '~/composables/3mf-exporter'

const props = defineProps<{
  modelGroup: Group | null
  fileName: string
}>()

const stlUrl = ref('')
const objUrl = ref('')
const gltfUrl = ref('')
const the3mfUrl = ref('')

let stlExporter: STLExporter
let objExporter: OBJExporter
let gltfExporter: GLTFExporter

function handleExportSTL() {
  const group = props.modelGroup
  if (!group)
    return

  stlExporter ||= new STLExporter()
  const result = stlExporter.parse(group, {
    binary: true,
  })

  stlUrl.value = URL.createObjectURL(new Blob([result], { type: 'application/octet-stream' }))
}

function handleExportOBJ() {
  const group = props.modelGroup
  if (!group)
    return

  objExporter ||= new OBJExporter()
  const result = objExporter.parse(group)

  objUrl.value = URL.createObjectURL(new Blob([result], { type: 'text/plain' }))
}

function handleExportGLTF() {
  const group = props.modelGroup
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

async function handleExport3MF() {
  const group = props.modelGroup
  if (!group)
    return

  const result = await exportTo3MF(group)
  the3mfUrl.value = URL.createObjectURL(result)
}

function clearUrls() {
  stlUrl.value = ''
  objUrl.value = ''
  gltfUrl.value = ''
  the3mfUrl.value = ''
}
</script>

<template>
  <div flex="~ col gap-2">
    <h2 text-lg flex="~ items-center gap-2">
      <div i-iconoir-floppy-disk-arrow-in />
      Export
    </h2>
    <div v-if="!(stlUrl || objUrl || gltfUrl || the3mfUrl)" flex="~ gap-2">
      <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportSTL">
        STL
      </button>
      <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportOBJ">
        OBJ
      </button>
      <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExportGLTF">
        GLTF
      </button>
      <button text-xl p2 rounded bg-gray:30 flex-1 cursor-pointer @click="handleExport3MF">
        3MF
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
      <a
        v-if="the3mfUrl"
        class="text-xl p2 text-center rounded bg-blue flex-1 w-full block"
        :href="the3mfUrl"
        :download="`${fileName}.3mf`"
        @click="the3mfUrl = ''"
      >
        Download The 3MF File
      </a>
      <button title="close" text-xl p2 rounded bg-gray cursor-pointer @click="clearUrls">
        <div i-carbon:close />
      </button>
    </div>
  </div>
</template>
