import Link from "next/link";
import RecentProjects from "./recent-projects";
import HomeEventBanner from "./home-event-banner";
import PlatformStats from "./platform-stats";

export default function Home() {
  return <main className="landing-page">
    <header className="landing-nav">
      <Link className="brand" href="/" aria-label="HackForge home"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link>
      <nav aria-label="Main navigation"><Link href="/events/demo-event">Events</Link><Link href="/gallery">Gallery</Link><Link href="/results">Results</Link></nav>
      <div className="landing-account"><Link href="/login">Log in</Link><Link className="button button-primary" href="/signup">Join HackForge <span aria-hidden="true">↗</span></Link></div>
    </header>

    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="landing-eyebrow"><span /> OPEN SOURCE · LOCAL FIRST · BUILT FOR BUILDERS</p>
        <h1 id="hero-title">Make something<br />that <em>moves</em> people.</h1>
        <p className="hero-description"><strong>HackForge — Open-source hackathon submission and judging platform.</strong> Bring participants, organizers and judges together, from the first team invite to the final results.</p>
        <div className="hero-actions"><Link className="button button-primary" href="#events">Explore events <span aria-hidden="true">→</span></Link><Link className="button button-secondary" href="/gallery">View gallery</Link></div>
        <div className="workflow-note"><span className="workflow-avatars"><i>H</i><i>F</i><i>+</i></span><span>One workspace for the whole hackathon.</span></div>
      </div>
      <div className="hero-visual" aria-label="HackForge event workflow preview">
        <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
        <div className="visual-stamp"><span className="brand-mark"><i/><i/><i/></span><span>IDEAS<br/>INTO IMPACT</span></div>
        <article className="visual-project"><div className="visual-project-top"><span className="visual-dot"/> PROJECT SPOTLIGHT · DEMO DATA <span className="visual-arrow">↗</span></div><div className="visual-art"><span>CS</span><i>◌</i><b>civic<br/>signal</b></div><div className="visual-project-bottom"><div><strong>CivicSignal</strong><small>Community track · Pixel Pioneers</small></div><span className="score-chip">8.0 <small>/ 10</small></span></div></article>
        <div className="visual-review"><span>JUDGE REVIEW</span><strong>Impact <b>8.0</b></strong><div><i/><i/><i/><i/><i/></div><small>Rubric-based, weighted scoring</small></div>
        <div className="visual-live"><i/> SUBMISSIONS OPEN</div>
      </div>
    </section>

    <PlatformStats />
    <HomeEventBanner />

    <section className="landing-how" aria-labelledby="how-title"><div className="section-intro"><p className="landing-eyebrow">FROM IDEA TO AWARDS</p><h2 id="how-title">A clear path from<br/><em>start</em> to showcase.</h2><p>Everything a hackathon needs, connected in one open platform.</p></div><ol className="how-steps"><li><span>01</span><div><h3>Create or join a team</h3><p>Find collaborators and organize around an event track.</p></div><b>↗</b></li><li><span>02</span><div><h3>Build and submit a project</h3><p>Shape your project page, save drafts, and submit before the deadline.</p></div><b>↗</b></li><li><span>03</span><div><h3>Judges review with a rubric</h3><p>Assigned judges score submissions against configurable criteria.</p></div><b>↗</b></li><li><span>04</span><div><h3>Results are published</h3><p>Share transparent rankings, feedback, and winning projects.</p></div><b>↗</b></li></ol></section>

    <section className="landing-projects" id="gallery"><div className="section-heading"><div><p className="landing-eyebrow">BUILT BY THE COMMUNITY</p><h2>Recent projects</h2></div><Link className="text-link" href="/gallery">Explore the gallery <span aria-hidden="true">→</span></Link></div><RecentProjects /></section>

    <section className="landing-cta"><div><p className="landing-eyebrow">YOUR NEXT BUILD STARTS HERE</p><h2>Make room for a good idea.</h2></div><Link className="button button-primary" href="/signup">Create your account <span aria-hidden="true">→</span></Link></section>
    <footer className="landing-footer"><Link className="brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span>Hack<span>Forge</span></span></Link><p>Open-source hackathon submission and judging platform.</p><nav aria-label="Footer navigation"><Link href="/events/demo-event">Events</Link><Link href="/gallery">Gallery</Link><Link href="/results">Results</Link><Link href="/login">Sign in</Link></nav><small>Made for people who make things. · Open source, built together.</small></footer>
  </main>;
}
