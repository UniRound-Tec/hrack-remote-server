/**
 * Browser-demo copy of HRack's renderer controller. Prefer WebGL for the same
 * glyph atlas and fall back to xterm's DOM renderer after any load/context loss.
 */
export function createRendererController(term, onKindChange) {
  let addon = null
  let disposed = false
  let activation = 0

  const publish = (kind) => onKindChange(kind)
  const release = () => {
    if (!addon) return
    const current = addon
    addon = null
    current.dispose()
    publish('dom')
  }

  return {
    async activate() {
      if (disposed || addon) return
      const currentActivation = ++activation
      let candidate = null
      try {
        if (!document.createElement('canvas').getContext('webgl2')) {
          publish('dom')
          return
        }
        const { WebglAddon } = await import('@xterm/addon-webgl')
        if (disposed || addon || activation !== currentActivation) return
        candidate = new WebglAddon()
        candidate.onContextLoss(() => {
          if (addon !== candidate) return
          release()
        })
        term.loadAddon(candidate)
        addon = candidate
        publish('webgl')
      } catch {
        candidate?.dispose()
        publish('dom')
      }
    },
    dispose() {
      disposed = true
      activation += 1
      release()
    }
  }
}
