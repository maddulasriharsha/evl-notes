/**
 * The opening moment, shown once per browser session: "VJ-NOTES" appears, the dash lifts out while
 * the two words close up, and the dash flies up and becomes the comet mark. Then the whole screen
 * melts into the page. About 2.5 seconds, drawn entirely in CSS (see "Intro" in globals.css).
 *
 * It is in the page from the first byte but hidden; the small script in the layout switches it on
 * (html.intro) before anything is painted, and only when it has not been seen this session and the
 * visitor has not asked for reduced motion. No script is needed to end it.
 */
export function Intro() {
  return (
    <div className="intro-screen" aria-hidden="true">
      <div className="intro-glow" />
      <div className="intro-stack">
        {/* The mark without its tile: just the comet, so nothing boxy sits on the screen. */}
        <svg viewBox="0 0 64 64" className="intro-logo">
          <g fill="currentColor" transform="translate(4 4) scale(0.875)">
            <path d="M26 28Q29 43 41 46Q29 49 26 63Q23 49 9 46Q23 43 26 28Z" />
            <path d="M30 42C42 38 51 30 62 12C52 33 41 45 28 52Z" />
            <path d="M5 10C11 24 17 35 25 44L22 48C15 38 8 25 5 10Z" />
          </g>
        </svg>
        <div className="intro-word">
          <span>VJ</span>
          <span className="intro-gap">
            <span className="intro-dash" />
          </span>
          <span>NOTES</span>
        </div>
      </div>
    </div>
  )
}
