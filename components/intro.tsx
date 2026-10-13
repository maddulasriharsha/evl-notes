import { IntroAim } from '@/components/intro-aim'

/**
 * The opening moment, shown once per browser session (about 4 seconds, see "Intro" in globals.css):
 *   1. "VJ-NOTES" appears.
 *   2. The dash lifts out and flies in an arc, glowing, while "VJ" and "NOTES" slide together.
 *   3. Where the dash lands above the word, it bursts into the comet mark.
 *   4. The words leave, then the dark sheet thins out over the page.
 *
 * It is in the page from the first byte but hidden; the small script in the layout switches it on
 * (html.intro) before anything is painted, and only when it has not been seen this session and the
 * visitor has not asked for reduced motion. The timeline is CSS; <IntroAim> only measures where the
 * dash has to land, because that depends on the font.
 */
export function Intro() {
  return (
    <div className="intro-screen" aria-hidden="true">
      <div className="intro-glow" />
      <div className="intro-stack">
        <div className="intro-mark">
          <span className="intro-ring" />
          {/* The mark without its tile: just the comet, so nothing boxy sits on the screen. */}
          <svg viewBox="0 0 64 64" className="intro-logo">
            <g fill="currentColor" transform="translate(4 4) scale(0.875)">
              <path d="M26 28Q29 43 41 46Q29 49 26 63Q23 49 9 46Q23 43 26 28Z" />
              <path d="M30 42C42 38 51 30 62 12C52 33 41 45 28 52Z" />
              <path d="M5 10C11 24 17 35 25 44L22 48C15 38 8 25 5 10Z" />
            </g>
          </svg>
        </div>
        <div className="intro-word">
          <span className="intro-l">VJ</span>
          <span className="intro-gap">
            <span className="intro-dash" />
          </span>
          <span className="intro-r">NOTES</span>
        </div>
      </div>
      <IntroAim />
    </div>
  )
}
