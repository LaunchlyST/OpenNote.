/**
 * Hero light: a soft green glimmer behind the headline.
 * Fallback for OriginKit "Glimmer Vale" (its site could not be reached from
 * the build environment): layered blurred ribbons that drift slowly. Pure CSS,
 * decorative, and static under prefers-reduced-motion.
 */
export function Glimmer() {
  return (
    <div className="lp-glimmer" aria-hidden="true">
      <span className="lp-glim lp-glim-a" />
      <span className="lp-glim lp-glim-b" />
      <span className="lp-glim lp-glim-c" />
      <span className="lp-glim-grain" />
    </div>
  )
}
