import { io } from "socket.io-client"
import { socketio_port } from "../../../../sites/common_site_config.json"

export function initSocket(options = {}) {
  let host = window.location.hostname
  let siteName = import.meta.env.DEV ? host : window.site_name
  let port = window.location.port ? `:${socketio_port}` : ""
  let protocol = port ? "http" : "https"
  let url = `${protocol}://${host}${port}/`
  // add exponential backoff
  let socket = io(url, {
    path: `${siteName}`,
    withCredentials: true,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  })

  // socket.on("connect_error", (data) => {
  //   console.log(data)
  // })
  return socket
}

// global socket conn state
export class RealTimeHandler {
  open_docs: Set<string>
  socket: Socket
  subscribing: boolean

  constructor(socket) {
    this.open_docs = new Set()
    this.socket = socket
    this.subscribing = false
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  emit(event: string, ...args: any[]) {
    this.socket.emit(event, ...args)
  }

  doc_subscribe(doctype: string, docname: string) {
    if (this.subscribing) {
      console.log("throttled")
      return
    }
    if (this.open_docs.has(`${doctype}:${docname}`)) {
      return
    }

    this.subscribing = true

    // throttle to 1 per sec
    setTimeout(() => {
      this.subscribing = false
    }, 1000)

    this.emit("doc_subscribe", doctype, docname)
    this.open_docs.add(`${doctype}:${docname}`)
  }
  doc_unsubscribe(doctype: string, docname: string) {
    this.emit("doc_unsubscribe", doctype, docname)
    return this.open_docs.delete(`${doctype}:${docname}`)
  }
  doc_open(doctype: string, docname: string) {
    this.emit("doc_open", doctype, docname)
  }
  doc_close(doctype: string, docname: string) {
    this.emit("doc_close", doctype, docname)
  }
  publish(event: string, message: any) {
    if (this.socket) {
      this.emit(event, message)
    }
  }
}
