// OptiDx wordmark — mimics the Syreon Middle East logo:
//   grey primary word · orange accent letter with underline · optional small line below
//
// Usage:
//   <Logo size="sm" />      → 20px tall, single-line, for rail/top-bar
//   <Logo size="md" />      → 32px tall, single-line
//   <Logo size="lg" stack/> → 56px tall with "Diagnostic pathway engine" below (auth hero)
//
// The visual DNA is deliberately close to the Syreon lock-up: same Carlito-ish
// stack, same orange accent-letter treatment with a bar underline beneath
// just the accent glyph.

function Logo({ size = "md", stack = false, onDark = false }) {
  const heights = { xs: 16, sm: 20, md: 32, lg: 56, xl: 72 };
  const h = heights[size] || 32;
  const ink = onDark ? "#FFFFFF" : "var(--sme-ink-600)";
  const inkDim = onDark ? "#B0B5B9" : "var(--sme-ink-300)";

  // The bar underline width is proportional to the accent glyphs ("Dx").
  return (
    <div
      className="optidx-logo"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        lineHeight: 1,
        fontFamily: "var(--font-display)",
        letterSpacing: "-0.02em",
        userSelect: "none",
      }}
    >
      <div style={{
        display: "inline-flex",
        alignItems: "baseline",
        fontSize: h,
        fontWeight: 700,
        letterSpacing: "-0.035em",
      }}>
        <span style={{ color: ink, fontWeight: 300 }}>Opti</span>
        <span style={{
          color: "var(--sme-orange)",
          fontWeight: 700,
          position: "relative",
          display: "inline-block",
          paddingBottom: h * 0.06,
        }}>
          Dx
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: h * 0.04,
              right: h * 0.04,
              bottom: 0,
              height: Math.max(2, h * 0.05),
              background: "var(--sme-orange)",
              borderRadius: 1,
            }}
          />
        </span>
      </div>
      {stack && (
        <div style={{
          marginTop: h * 0.18,
          color: "var(--sme-orange)",
          fontSize: h * 0.28,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}>
          Diagnostic pathway engine
        </div>
      )}
    </div>
  );
}

// Tiny mark used inside the dark rail — rounded orange square with a stylized
// lowercase "o" + accent dot. Mirrors the Syreon "e" accent trick.
function LogoMark({ size = 40 }) {
  return (
    <div
      title="OptiDx"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.18,
        background: "var(--sme-orange)",
        display: "grid",
        placeItems: "center",
        position: "relative",
        color: "#fff",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.52,
        fontWeight: 700,
        letterSpacing: "-0.06em",
      }}
    >
      <span style={{ lineHeight: 1, paddingBottom: size * 0.08 }}>Ox</span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: size * 0.22,
          right: size * 0.22,
          bottom: size * 0.18,
          height: Math.max(1.5, size * 0.045),
          background: "#fff",
          borderRadius: 1,
          opacity: 0.9,
        }}
      />
    </div>
  );
}

Object.assign(window, { Logo, LogoMark });
