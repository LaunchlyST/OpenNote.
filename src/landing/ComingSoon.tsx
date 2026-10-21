import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/id";
import { Logo, ButtonArrow } from "./components/primitives";
import { SITE, useDocumentMeta } from "./seo";
import { useEarlyAccess } from "./useEarlyAccess";
import type { EarlyAccess } from "./useEarlyAccess";

/**
 * Coming Soon — a page from the notebook.
 *
 * Desknoty is a notebook, so the screen is a ruled page: pale blue rules, a
 * red margin, and every line of type sitting on the rules. Beside the
 * headline is today's entry, a to-do list for the launch itself. Two items
 * are already ticked; the last one, "Open the doors", ticks itself when a
 * visitor slides the invite handle.
 *
 * One typeface (Inter, as on the landing page), ink on paper, no ornament.
 * Motion is what a page does: the rules draw across on load, the margin runs
 * down, the finished items tick in order.
 *
 * Early access: the handle rests on the left of the ink track and is dragged
 * RIGHT (or Enter / →); the invite code is verified by the backend before the
 * page leaves for /landing.
 */

const WIPE = "#191919";

const TODO = [
  { text: "Build the calendar", done: true },
  { text: "Add notes to every day", done: true },
  { text: "Open the doors", done: false },
];

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description);
  const ea = useEarlyAccess({ wipe: WIPE });
  const unlocked = ea.phase !== "swipe";
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(
      new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    );
    document.body.classList.add("lp-body");
    return () => document.body.classList.remove("lp-body");
  }, []);

  return (
    <div
      className={cn(
        "nb-page relative min-h-svh overflow-hidden text-lp-ink",
        ea.reduced && "nb-still",
      )}
    >
      <div
        aria-hidden="true"
        className="nb-rules pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="nb-margin pointer-events-none absolute inset-y-0"
      />

      <div className="nb-sheet relative">
        <header className="nb-row flex items-center justify-between">
          <Logo />
          <span className="text-[15px] text-lp-body tabular-nums">{date}</span>
        </header>

        <main className="nb-grid">
          <section aria-labelledby="nb-title" className="nb-main">
            <h1
              id="nb-title"
              className="nb-title font-semibold tracking-[-0.045em]"
            >
              <span
                className="nb-up block"
                style={{ "--i": 0 } as CSSProperties}
              >
                A notebook
              </span>
              <span
                className="nb-up block"
                style={{ "--i": 1 } as CSSProperties}
              >
                for your days.
              </span>
            </h1>
            <p
              className="nb-up nb-body mt-[var(--rule)] max-w-[34rem]"
              style={{ "--i": 2 } as CSSProperties}
            >
              Notes, to-dos and a calendar on one page. It’s free, and it opens
              soon.
            </p>
            <div
              className="nb-up mt-[var(--rule)] max-w-[400px]"
              style={{ "--i": 3 } as CSSProperties}
            >
              <Control ea={ea} />
            </div>
          </section>

          <section aria-labelledby="nb-todo" className="nb-side">
            <h2
              id="nb-todo"
              className="nb-row nb-up text-[15px] font-semibold"
              style={{ "--i": 2 } as CSSProperties}
            >
              Before launch
            </h2>
            <ul>
              {TODO.map((item, i) => {
                const done = item.done || unlocked;
                return (
                  <li
                    key={item.text}
                    className="nb-row nb-up flex items-center gap-3 text-[17px]"
                    style={{ "--i": 3 + i } as CSSProperties}
                  >
                    <Box done={done} delay={item.done ? 900 + i * 350 : 250} />
                    <span className="relative">
                      <span
                        className={cn(
                          "transition-colors duration-500",
                          done && "text-lp-muted",
                        )}
                      >
                        {item.text}
                      </span>
                      <span
                        aria-hidden="true"
                        className="nb-strike absolute top-1/2 left-0 h-[1.5px] w-full bg-lp-ink"
                        style={
                          {
                            "--d": `${item.done ? 1050 + i * 350 : 400}ms`,
                            transform: done ? "scaleX(1)" : "scaleX(0)",
                          } as CSSProperties
                        }
                      />
                      <span className="sr-only">
                        {done ? " (done)" : " (to do)"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

/** A checkbox whose tick draws itself. */
function Box({ done, delay }: { done: boolean; delay: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="18"
        height="18"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 10.5l3.2 3.2L15 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="nb-tick"
        style={
          {
            strokeDashoffset: done ? 0 : 20,
            "--d": `${delay}ms`,
          } as CSSProperties
        }
      />
    </svg>
  );
}

/* ------------------------------------------------------------ control --- */

function Control({ ea }: { ea: EarlyAccess }) {
  const errorId = "nb-invite-error";
  const passed = ea.progress;
  return (
    <div>
      <div className="nb-slot">
        {ea.phase === "swipe" ? (
          <div
            ref={ea.trackRef}
            role="button"
            tabIndex={0}
            aria-label="Enter with an invite — drag the handle right, or press Enter"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" ||
                e.key === " " ||
                e.key === "ArrowRight"
              ) {
                e.preventDefault();
                ea.swipeByKeyboard();
              }
            }}
            onPointerDown={ea.onPointerDown}
            className={cn(
              "relative flex h-[60px] w-full cursor-grab touch-none items-center rounded-[12px] bg-lp-ink select-none active:cursor-grabbing",
              ea.shake && "cs-shake",
            )}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-[6px] left-[6px] h-[48px] rounded-[8px] bg-white/[0.14]"
              style={{
                width: ea.knobX + 48,
                transition: ea.dragging
                  ? "none"
                  : "width .45s cubic-bezier(.34,1.4,.64,1)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 pl-12 text-center text-[15px] font-medium text-white"
              style={{ opacity: Math.max(0, 1 - passed * 1.8) }}
            >
              Slide to enter with an invite
            </span>
            <div
              aria-hidden="true"
              className="absolute top-[6px] left-[6px] grid h-[48px] w-[48px] place-items-center rounded-[8px] bg-white text-lp-ink"
              style={{
                transform: `translateX(${ea.knobX}px)`,
                transition: ea.dragging
                  ? "none"
                  : "transform .45s cubic-bezier(.34,1.4,.64,1)",
              }}
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
            </div>
          </div>
        ) : (
          <form
            onSubmit={ea.submit}
            className={cn(
              "cs-pop flex h-[60px] w-full items-center gap-1.5 rounded-[12px] border-[1.5px] bg-white p-[5px] focus-within:border-lp-ink",
              ea.isWrong ? "border-[#c02a21]" : "border-lp-ink/25",
              ea.shake && "cs-shake",
            )}
          >
            <input
              value={ea.code}
              onChange={(e) => {
                ea.setCode(e.target.value);
                if (ea.isWrong) ea.setPhase("code");
              }}
              disabled={ea.isChecking || ea.leaving}
              placeholder="Invite code"
              aria-label="Invite code"
              aria-invalid={ea.isWrong}
              aria-describedby={ea.isWrong ? errorId : undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-lp-ink placeholder:text-lp-muted"
              style={{ outline: "none" }}
            />
            <button
              type="submit"
              disabled={ea.isChecking || ea.leaving}
              className="group/btn inline-flex h-[46px] shrink-0 items-center gap-2 rounded-[8px] bg-lp-ink px-4 text-[15px] font-medium text-white transition-colors hover:bg-lp-ink-3 active:translate-y-px disabled:opacity-70"
            >
              {ea.isChecking ? "Checking…" : ea.leaving ? "Opening…" : "Enter"}
              <ButtonArrow />
            </button>
          </form>
        )}
      </div>

      <p
        className="nb-row nb-hint text-[15px] text-lp-body"
        role={ea.isWrong ? "alert" : undefined}
        id={ea.isWrong ? errorId : undefined}
      >
        {ea.isWrong ? (
          <span className="text-[#c02a21]">
            That code didn’t work. Check it and try again.
          </span>
        ) : ea.phase === "swipe" ? (
          "Invite only for now."
        ) : (
          "Type the code from your invite."
        )}
      </p>
    </div>
  );
}
