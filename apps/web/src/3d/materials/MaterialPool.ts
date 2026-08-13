interface Entry<M> {
  material: M
  refs: number
}

export class MaterialPool<K, M extends { dispose(): void }> {
  private readonly entries = new Map<K, Entry<M>>()

  acquire(key: K, factory: () => M): M {
    const existing = this.entries.get(key)
    if (existing) {
      existing.refs += 1
      return existing.material
    }

    const material = factory()
    this.entries.set(key, { material, refs: 1 })
    return material
  }

  release(key: K): void {
    const entry = this.entries.get(key)
    if (!entry) return

    entry.refs -= 1
    if (entry.refs > 0) return

    this.entries.delete(key)
    entry.material.dispose()
  }

  disposeAll(): void {
    for (const entry of this.entries.values()) entry.material.dispose()
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }
}
