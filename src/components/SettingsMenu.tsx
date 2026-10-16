import {
  PanelLeft,
  PanelRight,
  Settings as SettingsIcon,
} from 'lucide-react'
import { IconButton } from './ui'

/**
 * The Settings control in the toolbar. It is a toggle, not a popover: pressing
 * it swaps the right-hand rail between Notes and Preferences.
 */
export function SettingsMenu({
  onToggle,
  active = false,
}: {
  onToggle: () => void
  active?: boolean
}) {
  return (
    <IconButton
      label={active ? 'Close settings' : 'Settings'}
      active={active}
      onClick={onToggle}
    >
      <SettingsIcon className="h-[17px] w-[17px]" />
    </IconButton>
  )
}

export function PanelToggles({
  onToggleLeft,
  onToggleRight,
}: {
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  return (
    <>
      <IconButton
        label="Toggle sidebar"
        onClick={onToggleLeft}
        className="lg:hidden"
      >
        <PanelLeft className="h-[17px] w-[17px]" />
      </IconButton>
      <IconButton
        label="Toggle notes"
        onClick={onToggleRight}
        className="xl:hidden"
      >
        <PanelRight className="h-[17px] w-[17px]" />
      </IconButton>
    </>
  )
}