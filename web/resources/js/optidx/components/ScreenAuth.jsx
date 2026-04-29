// ==========================================================================
// Auth - Login, registration, email verification, and password reset.
// The screen is still the Syreon-branded split layout, but all buttons now
// call real Laravel endpoints instead of short-circuiting in client state.
// ==========================================================================

function AuthShell({ mode, setMode, onAuthed }) {
  const initialMode = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("auth") === "reset" ? "reset" : mode;
  })();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 520px)",
      background: "var(--surface)",
      zIndex: 200,
      overflow: "hidden",
    }}>
      <AuthHero/>
      <AuthForm mode={initialMode} setMode={setMode} onAuthed={onAuthed}/>
    </div>
  );
}

function AuthHero() {
  return (
    <div style={{
      position: "relative",
      background: "var(--sme-ink-900)",
      color: "#fff",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      padding: "40px 48px",
    }}>
      <svg viewBox="0 0 700 540" style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.55,
      }}>
        <defs>
          <marker id="auth-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="#F37739"/>
          </marker>
        </defs>
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={"v" + i} x1={i * 50} y1="0" x2={i * 50} y2="540" stroke="#3A4248" strokeWidth="0.5"/>
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={"h" + i} x1="0" y1={i * 50} x2="700" y2={i * 50} stroke="#3A4248" strokeWidth="0.5"/>
        ))}

        <rect x="70" y="230" width="120" height="54" rx="8" fill="#323A40" stroke="#4A5056"/>
        <text x="130" y="256" textAnchor="middle" fontSize="12" fill="#B0B5B9" fontWeight="700">SYMPTOM</text>
        <text x="130" y="272" textAnchor="middle" fontSize="10" fill="#6E777E">WHO-4 · Se 0.77</text>

        <rect x="280" y="160" width="120" height="54" rx="8" fill="#323A40" stroke="#4A5056"/>
        <text x="340" y="186" textAnchor="middle" fontSize="12" fill="#B0B5B9" fontWeight="700">CAD4TB</text>
        <text x="340" y="202" textAnchor="middle" fontSize="10" fill="#6E777E">Imaging · Se 0.90</text>

        <rect x="280" y="306" width="120" height="54" rx="8" fill="#323A40" stroke="#4A5056"/>
        <text x="340" y="332" textAnchor="middle" fontSize="12" fill="#B0B5B9" fontWeight="700">XPERT</text>
        <text x="340" y="348" textAnchor="middle" fontSize="10" fill="#6E777E">Molecular · Se 0.88</text>

        <rect x="500" y="90" width="130" height="40" rx="6" fill="#F37739" opacity="0.22" stroke="#F37739"/>
        <text x="565" y="115" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F37739">TREAT TB</text>

        <rect x="500" y="232" width="130" height="40" rx="6" fill="#3F7D5B" opacity="0.2" stroke="#3F7D5B"/>
        <text x="565" y="257" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5B9A77">CONFIRM</text>

        <rect x="500" y="378" width="130" height="40" rx="6" fill="#5A6B78" opacity="0.22" stroke="#5A6B78"/>
        <text x="565" y="403" textAnchor="middle" fontSize="11" fontWeight="700" fill="#9AA8B3">RULE OUT</text>

        <path d="M190 250 Q 240 225 280 190" stroke="#F37739" strokeWidth="1.5" fill="none" markerEnd="url(#auth-ar)"/>
        <path d="M190 268 Q 240 305 280 333" stroke="#5A6B78" strokeWidth="1.5" strokeDasharray="4 3" fill="none" markerEnd="url(#auth-ar)"/>
        <path d="M400 180 Q 450 150 500 115" stroke="#F37739" strokeWidth="1.5" fill="none"/>
        <path d="M400 200 Q 450 220 500 250" stroke="#3F7D5B" strokeWidth="1.5" fill="none"/>
        <path d="M400 330 Q 450 365 500 395" stroke="#5A6B78" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <path d="M400 322 Q 450 290 500 262" stroke="#F37739" strokeWidth="1.5" fill="none"/>
      </svg>

      <div style={{position:"relative", zIndex:1, display:"flex", alignItems:"center", gap:10}}>
        <Logo size="md" onDark/>
        <span style={{
          display:"inline-flex",
          alignItems:"center",
          gap:6,
          background:"var(--sme-orange)",
          color:"#fff",
          fontFamily:"var(--font-display)",
          fontWeight:800,
          fontSize:9.5,
          letterSpacing:"0.18em",
          textTransform:"uppercase",
          padding:"4px 8px 3px",
          borderRadius:3,
          lineHeight:1,
          marginTop:2,
        }}>
          <span style={{width:5, height:5, borderRadius:"50%", background:"#fff"}}/>
          Beta
        </span>
      </div>

      <div style={{flex:1}}/>

      <div style={{position:"relative", zIndex:1, maxWidth:460}}>
        <div className="sme-eyebrow" style={{color:"var(--sme-orange)", marginBottom:12, fontSize:11, letterSpacing:"0.16em"}}>
          SYREON · DIAGNOSTIC PATHWAY ENGINE
        </div>
        <h1 style={{fontSize:36, lineHeight:1.15, letterSpacing:"-0.02em", marginBottom:12, color:"#fff", textWrap:"balance"}}>
          Design and evaluate diagnostic pathways, grounded in published evidence.
        </h1>
        <p style={{fontSize:14, color:"#B0B5B9", lineHeight:1.55, marginBottom:24}}>
          Drag tests onto a canvas. Route them with rules. OptiDx scores every path for
          sensitivity, specificity, cost per detected case, turnaround time, and feasibility.
        </p>
      </div>

      <div style={{position:"relative", zIndex:1, marginTop:32, fontSize:10, color:"#6E777E", letterSpacing:"0.14em", textTransform:"uppercase"}}>
        TODAY'S RESEARCH FOR TOMORROW'S HEALTH
      </div>
    </div>
  );
}

function AuthForm({ mode, setMode, onAuthed }) {
  const [flash, setFlash] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resetInfo, setResetInfo] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get("token") || "",
      email: params.get("email") || "",
    };
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "reset" && params.get("token")) {
      setMode("reset");
      setResetInfo({
        token: params.get("token") || "",
        email: params.get("email") || "",
      });
    }
    if (params.get("auth") === "verified") {
      setFlash("Your email address has been verified. Sign in to continue.");
      setMode("login");
    }
  }, [setMode]);

  const sendVerification = (email) => {
    setVerificationEmail(email);
    setMode("verify");
    setFlash("We sent a verification email. Open the link to activate your account.");
  };

  return (
    <div style={{
      display:"flex",
      flexDirection:"column",
      padding:"40px 56px",
      background:"var(--surface)",
      overflowY:"auto",
    }}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32}}>
        <div style={{fontSize:11, color:"var(--fg-3)", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700}}>
          {mode === "login" || mode === "forgot" || mode === "reset" || mode === "verify" ? "Sign in" : "Create account"}
        </div>
        <div style={{fontSize:12, color:"var(--fg-3)"}}>
          {mode === "login" ? "New here?" : "Have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{color:"var(--sme-orange)", fontWeight:700, cursor:"pointer", background:"none", padding:0}}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </div>

      {flash && (
        <div className="banner banner--info" style={{marginBottom:20}}>
          <Icon name="info" size={16} className="banner__icon"/>
          <div>{flash}</div>
        </div>
      )}

      <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"center", maxWidth:380, width:"100%", marginLeft:"auto", marginRight:"auto"}}>
        {mode === "login" && <LoginForm onAuthed={onAuthed} onForgot={() => setMode("forgot")} onNeedVerification={sendVerification}/>}
        {mode === "register" && <RegisterForm onNeedVerification={sendVerification} />}
        {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")}/>}
        {mode === "reset" && <ResetPasswordForm resetInfo={resetInfo} onAuthed={onAuthed} onBack={() => setMode("login")}/>}
        {mode === "verify" && <VerifyNotice email={verificationEmail} onBack={() => setMode("login")}/>}
      </div>

      <div style={{marginTop:32, paddingTop:24, borderTop:"1px solid var(--edge)", display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--fg-3)"}}>
        <span>© 2026 Syreon</span>
        <span>
          <button type="button" className="link-button" style={{color:"var(--fg-3)", marginRight:12, background:"none", padding:0}} onClick={() => window.OptiDxActions.comingSoon("Privacy policy")}>Privacy</button>
          <button type="button" className="link-button" style={{color:"var(--fg-3)", marginRight:12, background:"none", padding:0}} onClick={() => window.OptiDxActions.comingSoon("Terms of service")}>Terms</button>
          <button type="button" className="link-button" style={{color:"var(--fg-3)", background:"none", padding:0}} onClick={() => window.OptiDxActions.comingSoon("Support")}>Support</button>
        </span>
      </div>
    </div>
  );
}

function SSORow() {
  return (
    <>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20}}>
        <button type="button" className="btn" style={{justifyContent:"center"}} onClick={() => window.OptiDxActions.comingSoon("Google sign-in")}>
          <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2c-2 1.5-4.5 2.5-7.3 2.5-5.2 0-9.6-3.3-11.3-8L6.2 33C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2C41 35.6 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          Google
        </button>
        <button type="button" className="btn" style={{justifyContent:"center"}} onClick={() => window.OptiDxActions.comingSoon("Microsoft sign-in")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0078D4"><path d="M11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4zM11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24z"/></svg>
          Microsoft
        </button>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:20}}>
        <div style={{flex:1, height:1, background:"var(--edge)"}}/>
        <span style={{fontSize:11, color:"var(--fg-3)", letterSpacing:"0.08em", textTransform:"uppercase"}}>or with email</span>
        <div style={{flex:1, height:1, background:"var(--edge)"}}/>
      </div>
    </>
  );
}

function LoginForm({ onAuthed, onForgot, onNeedVerification }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await window.OptiDxActions.request("post", "/auth/login", {
        email,
        password: pwd,
        remember,
      });
      await window.OptiDxActions.refreshCsrfToken?.();
      window.history.replaceState({}, "", window.location.pathname);
      window.location.assign(window.location.pathname);
      onAuthed(payload.user);
    } catch (err) {
      const response = err?.response?.data;
      if (err?.response?.status === 409 || response?.requires_verification) {
        onNeedVerification(response?.email || email);
      } else {
        setError(response?.message || "Unable to sign in.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 style={{fontSize:28, letterSpacing:"-0.01em", marginBottom:6}}>Welcome back.</h1>
      <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:24}}>Continue building your diagnostic pathway workspace.</p>
      <SSORow/>

      <div className="stack" style={{gap:14, marginBottom:20}}>
        <div className="field">
          <label className="field__label">Work email</label>
          <input className="input" type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/>
        </div>
        <div className="field">
          <label className="field__label" style={{display:"flex", justifyContent:"space-between"}}>
            <span>Password</span>
            <button type="button" onClick={onForgot} style={{color:"var(--sme-orange)", fontWeight:400, fontSize:11, cursor:"pointer", background:"none", padding:0}}>
              Forgot?
            </button>
          </label>
          <input className="input" type="password" name="password" autoComplete="current-password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Enter your password"/>
        </div>
        <label style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--fg-2)", cursor:"pointer"}}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{accentColor:"var(--sme-orange)"}}/>
          Keep me signed in on this device
        </label>
      </div>

      {error && <div className="banner banner--warn" style={{marginBottom:14}}><Icon name="alert-triangle" size={14} className="banner__icon"/><div>{error}</div></div>}

      <button type="submit" className="btn btn--primary" style={{width:"100%", justifyContent:"center", height:40}} disabled={busy}>
        {busy ? "Signing in..." : <>Sign in to OptiDx <Icon name="arrow-right"/></>}
      </button>

      <div style={{marginTop:18, padding:12, background:"var(--surface-2)", borderRadius:4, fontSize:11, color:"var(--fg-3)", lineHeight:1.5}}>
        <b style={{color:"var(--fg-2)"}}>Single sign-on</b> is enabled for Syreon organizations.
        If your email is on a managed domain you'll be redirected to your IdP.
      </div>
    </form>
  );
}

function RegisterForm({ onNeedVerification }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    pwd: "",
    org: "",
    role: "Health economist",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await window.OptiDxActions.request("post", "/auth/register", {
        first_name: form.first,
        last_name: form.last,
        email: form.email,
        password: form.pwd,
        organization: form.org,
        role: form.role,
      });
      onNeedVerification(payload.email || form.email);
    } catch (err) {
      const response = err?.response?.data;
      setError(response?.message || "Unable to create the account.");
    } finally {
      setBusy(false);
    }
  };

  if (step === 2) {
    return (
      <form onSubmit={submit}>
        <div style={{fontSize:11, color:"var(--fg-3)", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700, marginBottom:8}}>Step 2 of 2</div>
        <h1 style={{fontSize:26, marginBottom:6, letterSpacing:"-0.01em"}}>Tell us about your work.</h1>
        <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:22}}>We'll pre-populate your workspace with relevant templates.</p>

        <div className="stack" style={{gap:14, marginBottom:22}}>
          <div className="field">
            <label className="field__label">Organization</label>
            <input className="input" placeholder="Ministry of Health · WHO · Hospital · University" value={form.org} onChange={e => upd("org", e.target.value)}/>
          </div>
          <div className="field">
            <label className="field__label">Primary role</label>
            <select className="select" value={form.role} onChange={e => upd("role", e.target.value)}>
              <option>Health economist</option>
              <option>Clinician</option>
              <option>Lab director</option>
              <option>Epidemiologist</option>
              <option>Policymaker</option>
              <option>Researcher</option>
              <option>Student</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">What will you use OptiDx for?</label>
            <div className="row row--wrap" style={{gap:6}}>
              {["HTA / cost-effectiveness", "Screening programs", "Clinical guidelines", "Research", "Teaching"].map((t, i) =>
                <button type="button" key={t} className={"btn btn--sm" + (i < 2 ? " btn--ink" : "")} onClick={() => upd("role", t)}>{t}</button>
              )}
            </div>
          </div>
        </div>

        <label style={{display:"flex", alignItems:"flex-start", gap:8, fontSize:11, color:"var(--fg-3)", lineHeight:1.5, marginBottom:18}}>
          <input type="checkbox" defaultChecked style={{accentColor:"var(--sme-orange)", marginTop:2}}/>
          I agree to the Terms of Service and Privacy Policy, and I understand OptiDx outputs are for research and planning use only.
        </label>

        {error && <div className="banner banner--warn" style={{marginBottom:14}}><Icon name="alert-triangle" size={14} className="banner__icon"/><div>{error}</div></div>}

        <div style={{display:"flex", gap:8}}>
          <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
          <div style={{flex:1}}/>
          <button type="submit" className="btn btn--primary" style={{height:40}} disabled={busy}>
            {busy ? "Creating..." : <>Create workspace <Icon name="arrow-right"/></>}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
      <div style={{fontSize:11, color:"var(--fg-3)", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700, marginBottom:8}}>Step 1 of 2</div>
      <h1 style={{fontSize:26, marginBottom:6, letterSpacing:"-0.01em"}}>Create your OptiDx account.</h1>
      <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:22}}>Free for academic and non-profit use. Start building pathways in under a minute.</p>

      <SSORow/>

      <div className="stack" style={{gap:14, marginBottom:20}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div className="field">
            <label className="field__label">First name</label>
            <input className="input" name="first_name" autoComplete="given-name" value={form.first} onChange={e => upd("first", e.target.value)} required/>
          </div>
          <div className="field">
            <label className="field__label">Last name</label>
            <input className="input" name="last_name" autoComplete="family-name" value={form.last} onChange={e => upd("last", e.target.value)} required/>
          </div>
        </div>
        <div className="field">
          <label className="field__label">Work email</label>
          <input className="input" type="email" name="email" autoComplete="email" value={form.email} onChange={e => upd("email", e.target.value)} required/>
          <div className="field__hint">Use your organization email for automatic workspace detection.</div>
        </div>
        <div className="field">
          <label className="field__label">Password</label>
          <input className="input" type="password" name="password" autoComplete="new-password" value={form.pwd} onChange={e => upd("pwd", e.target.value)} required minLength={8}/>
          <PwdMeter pwd={form.pwd}/>
        </div>
      </div>

      <button type="submit" className="btn btn--primary" style={{width:"100%", justifyContent:"center", height:40}}>
        Continue <Icon name="arrow-right"/>
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await window.OptiDxActions.request("post", "/auth/forgot-password", { email });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <h1 style={{fontSize:28, letterSpacing:"-0.01em", marginBottom:6}}>Check your inbox.</h1>
        <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:18}}>
          If an account exists for <b>{email}</b>, we sent a password reset link.
        </p>
        <button type="button" className="btn btn--primary" onClick={onBack}>Back to sign in</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 style={{fontSize:28, letterSpacing:"-0.01em", marginBottom:6}}>Reset your password.</h1>
      <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:24}}>
        We'll email you a secure reset link if the address belongs to an OptiDx account.
      </p>
      <div className="field" style={{marginBottom:18}}>
        <label className="field__label">Work email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required/>
      </div>
      <div style={{display:"flex", gap:8}}>
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <div style={{flex:1}}/>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ resetInfo, onBack, onAuthed }) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await window.OptiDxActions.request("post", "/auth/reset-password", {
        token: resetInfo.token,
        email: resetInfo.email,
        password,
        password_confirmation: passwordConfirmation,
      });
      onAuthed(payload.user);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      const response = err?.response?.data;
      setError(response?.message || "Unable to reset the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 style={{fontSize:28, letterSpacing:"-0.01em", marginBottom:6}}>Choose a new password.</h1>
      <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:24}}>
        Resetting for <b>{resetInfo.email || "your account"}</b>.
      </p>
      <div className="stack" style={{gap:14, marginBottom:20}}>
        <div className="field">
          <label className="field__label">New password</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}/>
        </div>
        <div className="field">
          <label className="field__label">Confirm password</label>
          <input className="input" type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} required minLength={8}/>
        </div>
      </div>
      {error && <div className="banner banner--warn" style={{marginBottom:14}}><Icon name="alert-triangle" size={14} className="banner__icon"/><div>{error}</div></div>}
      <div style={{display:"flex", gap:8}}>
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <div style={{flex:1}}/>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Resetting..." : "Reset password"}</button>
      </div>
    </form>
  );
}

function VerifyNotice({ email, onBack }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const resend = async () => {
    setBusy(true);
    setStatus("");
    try {
      await window.OptiDxActions.request("post", "/auth/verification-notification", { email });
      setStatus("Verification email resent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 style={{fontSize:28, letterSpacing:"-0.01em", marginBottom:6}}>Verify your email.</h1>
      <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:16}}>
        We sent a verification link to <b>{email || "your inbox"}</b>. Open it to activate the account.
      </p>
      {status && <div className="banner banner--info" style={{marginBottom:14}}><Icon name="info" size={14} className="banner__icon"/><div>{status}</div></div>}
      <div style={{display:"flex", gap:8}}>
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <div style={{flex:1}}/>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={resend}>{busy ? "Sending..." : "Resend email"}</button>
      </div>
    </div>
  );
}

function PwdMeter({ pwd }) {
  const score = Math.min(4, Math.floor(pwd.length / 3));
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#D3D6D9", "#C04B3A", "#C08A2A", "#4A7DA6", "#3F7D5B"];
  return (
    <div style={{marginTop:6}}>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:3, marginBottom:4}}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{height:3, borderRadius:2, background: i < score ? colors[score] : "var(--surface-3)"}}/>
        ))}
      </div>
      <div style={{fontSize:11, color:"var(--fg-3)"}}>Password strength: <b style={{color:colors[score]}}>{labels[score]}</b></div>
    </div>
  );
}

Object.assign(window, { AuthShell });
