import { UserRound } from 'lucide-react'
import { cn } from '../lib/id'

interface AvatarProps {
  name?: string
  src?: string
  size?: number
  className?: string
}

/** Circular avatar: profile picture, first initial, or a neutral fallback. */
export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf9bf] text-[#4b6410]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : initial ? (
        <span
          className="font-semibold leading-none"
          style={{ fontSize: size * 0.42 }}
        >
          {initial}
        </span>
      ) : (
        <UserRound
          className="text-[#8b90a0]"
          style={{ width: size * 0.52, height: size * 0.52 }}
        />
      )}
    </span>
  )
}
