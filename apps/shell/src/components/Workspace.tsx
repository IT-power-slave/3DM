import React from 'react'
import { ProjectManagerPanel } from '@3dm/project-manager'
import { Editor2DPanel } from '@3dm/editor-2d'
import { Editor3DPanel } from '@3dm/editor-3d'
import { Viewer3DPanel } from '@3dm/viewer-3d'
import { ExportPanel } from '@3dm/export'
import { MaterialsPanel } from '@3dm/materials'
import { bus } from '@3dm/event-bus'

type PanelId = 'project' | '2d' | '3d' | 'viewer' | 'export' | 'materials'

const PANELS: Array<{ id: PanelId; label: string }> = [
  { id: 'project', label: '📁 Project' },
  { id: '2d', label: '✏️ 2D Editor' },
  { id: '3d', label: '📦 3D Editor' },
  { id: 'viewer', label: '👁 Viewer' },
  { id: 'export', label: '💾 Export' },
  { id: 'materials', label: '🎨 Materials' },
]

function PanelError({ name }: { name: string }) {
  return (
    <div style={panelStyles.error}>
      <span style={panelStyles.errorText}>⚠ {name} failed to load</span>
    </div>
  )
}

class PanelErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return <PanelError name={this.props.name} />
    return this.props.children
  }
}

export function Workspace(): React.ReactElement {
  const [activePanel, setActivePanel] = React.useState<PanelId>('project')

  const handleTabClick = (id: PanelId) => {
    setActivePanel(id)
    // Notify panels so they can resize their canvases/viewports
    bus.emit('panel:activated', { panelId: id })
  }

  // All panels are always mounted so MFEs can register and receive shell:ready.
  // Only the active panel is visible via CSS.
  const panelVisible = (id: PanelId) =>
    activePanel === id ? styles.panelArea : { ...styles.panelArea, ...styles.hidden }

  return (
    <div style={styles.workspace}>
      {/* Sidebar tabs */}
      <div style={styles.sidebar}>
        {PANELS.map((p) => (
          <button
            key={p.id}
            style={{
              ...styles.sideBtn,
              ...(activePanel === p.id ? styles.sideBtnActive : {}),
            }}
            onClick={() => handleTabClick(p.id)}
            title={p.label}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* All panels pre-mounted; only active one visible */}
      <div style={panelVisible('project')}>
        <PanelErrorBoundary name="Project Manager">
          <ProjectManagerPanel />
        </PanelErrorBoundary>
      </div>
      <div style={panelVisible('2d')}>
        <PanelErrorBoundary name="2D Editor">
          <Editor2DPanel />
        </PanelErrorBoundary>
      </div>
      <div style={panelVisible('3d')}>
        <PanelErrorBoundary name="3D Editor">
          <Editor3DPanel />
        </PanelErrorBoundary>
      </div>
      <div style={panelVisible('viewer')}>
        <PanelErrorBoundary name="3D Viewer">
          <Viewer3DPanel />
        </PanelErrorBoundary>
      </div>
      <div style={panelVisible('export')}>
        <PanelErrorBoundary name="Export">
          <ExportPanel />
        </PanelErrorBoundary>
      </div>
      <div style={panelVisible('materials')}>
        <PanelErrorBoundary name="Materials">
          <MaterialsPanel />
        </PanelErrorBoundary>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    width: 140,
    background: '#222',
    borderRight: '1px solid #333',
    flexShrink: 0,
    padding: '8px 0',
    gap: 2,
  },
  sideBtn: {
    background: 'transparent',
    border: 'none',
    color: '#aaa',
    fontSize: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: 4,
    margin: '0 4px',
  },
  sideBtnActive: {
    background: '#2d4a6e',
    color: '#7eb3f7',
  },
  panelArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'absolute',
    inset: 0,
    left: 140,
  },
  hidden: {
    visibility: 'hidden',
    pointerEvents: 'none',
  },
}

const panelStyles: Record<string, React.CSSProperties> = {
  error: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a1a',
  },
  errorText: { color: '#ef4444', fontSize: 14 },
}
