// Imported first by main.tsx, so local mode wraps fetch before any client
// (Better Auth's included) captures it.
import { installLocalMode } from './lib/local-mode'

installLocalMode()
