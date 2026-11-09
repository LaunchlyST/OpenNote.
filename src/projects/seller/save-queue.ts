/** One writer per editor. Edits made during a request remain dirty. */
export class SaveQueue<T> {
  private running: Promise<void> | null = null
  private generation = 0
  private saved = 0
  value: T
  revision: number
  private write: (value: T, revision: number) => Promise<number>
  private persist: (value: T, revision: number) => void
  private clear: () => void
  constructor(value: T, revision: number, write: (value: T, revision: number) => Promise<number>, persist: (value: T, revision: number) => void, clear: () => void) {
    this.value = value; this.revision = revision; this.write = write; this.persist = persist; this.clear = clear
  }
  get dirty() { return this.generation !== this.saved }
  edit(value: T) { this.value = value; this.generation++; this.persist(value, this.revision) }
  flush(): Promise<void> {
    if (this.running) return this.running
    this.running = (async () => {
      while (this.dirty) {
        const generation = this.generation
        this.revision = await this.write(this.value, this.revision)
        this.saved = generation
        if (this.dirty) this.persist(this.value, this.revision)
        else this.clear()
      }
    })().finally(() => { this.running = null })
    return this.running
  }
}
