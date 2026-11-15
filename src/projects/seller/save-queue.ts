/** One writer per editor. Edits made during a request remain dirty. */
export class SaveQueue<T> {
  private running: Promise<void> | null = null
  private generation = 0
  private saved = 0
  value: T
  /** The server revision this value was written against. */
  revision: number
  /** Identifies this editor to the server, so a lost reply is not a conflict. */
  token: string
  private write: (value: T, revision: number, token: string) => Promise<number>
  private persist: (value: T, revision: number, token: string) => void
  private clear: () => void
  constructor(value: T, revision: number, token: string, write: (value: T, revision: number, token: string) => Promise<number>, persist: (value: T, revision: number, token: string) => void, clear: () => void) {
    this.value = value; this.revision = revision; this.token = token; this.write = write; this.persist = persist; this.clear = clear
  }
  get dirty() { return this.generation !== this.saved }
  edit(value: T) { this.value = value; this.generation++; this.persist(value, this.revision, this.token) }
  /** Throws away the pending edits and takes the server's state instead. */
  reset(value: T, revision: number) {
    this.value = value; this.revision = revision; this.generation = 0; this.saved = 0
    this.clear()
  }
  flush(): Promise<void> {
    if (this.running) return this.running
    this.running = (async () => {
      while (this.dirty) {
        const generation = this.generation
        this.revision = await this.write(this.value, this.revision, this.token)
        this.saved = generation
        if (this.dirty) this.persist(this.value, this.revision, this.token)
        else this.clear()
      }
    })().finally(() => { this.running = null })
    return this.running
  }
}
