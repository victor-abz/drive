<template>
  <FolderContentsError v-if="document.error" :error="document.error" />
  <div v-else class="flex w-full">
    <TextEditor
      v-if="contentLoaded"
      v-model:yjsContent="yjsContent"
      v-model:rawContent="rawContent"
      v-model:lastSaved="lastSaved"
      v-model:settings="settings"
      :user-list="allUsers.data || []"
      :fixed-menu="true"
      :bubble-menu="true"
      :timeout="timeout"
      :is-writable="isWritable"
      :entity-name="entityName"
      :entity="entity"
      @mentioned-users="(val) => (mentionedUsers = val)"
      @save-document="saveDocument"
    />
    <ShareDialog
      v-if="showShareDialog"
      v-model="showShareDialog"
      :entity-name="entityName"
    />
  </div>
</template>

<script setup>
import { fromUint8Array, toUint8Array } from "js-base64"
import {
  ref,
  computed,
  inject,
  onMounted,
  defineAsyncComponent,
  onBeforeUnmount,
} from "vue"
import { useRoute } from "vue-router"
import { useStore } from "vuex"
import { formatSize, formatDate } from "@/utils/format"
import { createResource } from "frappe-ui"
import { watchDebounced } from "@vueuse/core"
import { setBreadCrumbs } from "@/utils/files"
import { allUsers } from "@/resources/permissions"
import { setMetaData } from "../utils/files"
import router from "@/router"

const TextEditor = defineAsyncComponent(() =>
  import("@/components/DocEditor/TextEditor.vue")
)
const ShareDialog = defineAsyncComponent(() =>
  import("@/components/ShareDialog/ShareDialog.vue")
)

const store = useStore()
const route = useRoute()
const emitter = inject("emitter")

const props = defineProps({
  entityName: {
    type: String,
    required: false,
    default: "",
  },
})

// Reactive data properties
const oldTitle = ref(null)
const title = ref(null)
const yjsContent = ref(null)
const settings = ref(null)
const rawContent = ref(null)
const contentLoaded = ref(false)
const isWritable = ref(false)
const entity = ref(null)
const mentionedUsers = ref([])
const showShareDialog = ref(false)
const timeout = ref(1000 + Math.floor(Math.random() * 1000))
const saveCount = ref(0)
const lastSaved = ref(0)
const titleVal = computed(() => title.value || oldTitle.value)
const comments = computed(() => store.state.allComments)
const userId = computed(() => store.state.auth.user_id)
let intervalId = ref(null)

setTimeout(() => {
  watchDebounced(
    [rawContent, comments],
    () => {
      saveDocument()
    },
    {
      debounce: timeout.value,
      maxWait: 30000,
      immediate: true,
    }
  )
}, 1500)

const saveDocument = () => {
  if (isWritable.value || entity.value.comment) {
    updateDocument.submit({
      entity_name: props.entityName,
      doc_name: entity.value.document,
      title: titleVal.value,
      content: fromUint8Array(yjsContent.value),
      raw_content: rawContent.value,
      settings: settings.value,
      comments: comments.value,
      mentions: mentionedUsers.value,
      file_size: fromUint8Array(yjsContent.value).length,
    })
  }
}

const document = createResource({
  url: "drive.api.permissions.get_entity_with_permissions",
  method: "GET",
  auto: true,
  params: {
    entity_name: props.entityName,
  },
  onSuccess(data) {
    setMetaData(data)
    data.size_in_bytes = data.file_size
    data.file_size = formatSize(data.file_size)
    data.modified = formatDate(data.modified)
    data.creation = formatDate(data.creation)
    store.commit("setEntityInfo", [data])
    store.commit("setActiveEntity", data)
    if (!data.settings) {
      data.settings =
        '{ "docWidth": false, "docSize": true, "docFont": "font-fd-sans", "docHeader": false, "docHighlightAnnotations": false, "docSpellcheck": false}'
    }
    settings.value = JSON.parse(data.settings)

    if (!("docSpellcheck" in settings.value)) {
      settings.value.docSpellcheck = 1
    }
    title.value = data.title
    oldTitle.value = data.title
    yjsContent.value = toUint8Array(data.content)
    rawContent.value = data.raw_content
    isWritable.value = data.owner === userId.value || !!data.write
    store.commit("setHasWriteAccess", isWritable)
    data.owner = data.owner === userId.value ? "You" : data.owner
    entity.value = data
    lastSaved.value = Date.now()
    contentLoaded.value = true
    setBreadCrumbs(data.breadcrumbs, data.is_private, () => {
      data.write && emitter.emit("rename")
    })
  },
  onError() {
    if (!store.getters.isLoggedIn) router.push({ name: "Login" })
  },
})

const updateDocument = createResource({
  url: "drive.api.files.save_doc",
  debounce: 0,
  auto: false,
  onSuccess() {
    lastSaved.value = Date.now()
    saveCount.value++
  },
  onError(data) {
    console.log(data)
  },
})

onMounted(() => {
  allUsers.fetch({ team: route.params?.team })
  emitter.on("showShareDialog", () => {
    showShareDialog.value = true
  })
  if (saveCount.value > 0) {
    intervalId.value = setInterval(() => {
      emitter.emit("triggerAutoSnapshot")
    }, 120000 + timeout.value)
  }
})

onBeforeUnmount(() => {
  if (saveCount.value) {
    saveDocument()
  }
  if (intervalId.value !== null) {
    clearInterval(intervalId.value)
  }
})
</script>
