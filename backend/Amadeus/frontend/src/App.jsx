import React, { useState, useRef, useEffect } from 'react'
import { Code2, Database, Shield, ChevronRight, Zap, Target, Layers, ChevronDown, Box, Cpu, Network, Lock, Blocks, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShaderAnimation } from './components/ShaderAnimation'
import { CircularTestimonials } from './components/CircularTestimonials'
import DigitalSerenityHero from './components/DigitalSerenityHero'
import Logo from './components/Logo'
import './App.css'

// A reusable component for scroll-based fade in animation
const FadeInScroll = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.8, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
)

// Typing Animation Component
const TypewriterText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 150);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        style={{ borderRight: "4px solid #8b5cf6", marginLeft: "4px" }}
      />
    </span>
  );
}

// Mega menu item with hover highlight
const MegaMenuItem = ({ icon, title, desc, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: hovered ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hovered ? '#a78bfa' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s',
      }}>{icon}</div>
      <div>
        <p style={{ fontWeight: 500, fontSize: '0.9rem', color: hovered ? 'white' : 'rgba(255,255,255,0.85)', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
  )
}

// Solutions menu item — icon + title inline (like screenshot)
const SolutionItem = ({ icon, title, desc, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 12px', borderRadius: 8, cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hovered ? 'white' : 'rgba(255,255,255,0.55)',
        transition: 'color 0.2s',
      }}>{icon}</div>
      <div>
        <p style={{
          fontWeight: 500, fontSize: '0.95rem',
          color: hovered ? 'white' : 'rgba(255,255,255,0.85)',
          transition: 'color 0.15s', marginBottom: 2,
        }}>{title}</p>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>{desc}</p>
      </div>
    </div>
  )
}

// Flat resource link with icon (left section of Resources dropdown)
const ResourceLink = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 10px', borderRadius: 6, cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ color: hovered ? 'white' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 400, color: hovered ? 'white' : 'rgba(255,255,255,0.75)', transition: 'color 0.15s' }}>{label}</span>
    </div>
  )
}

// Blog card with thumbnail + title (right section of Resources dropdown)
const BlogCard = ({ img, title, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px', borderRadius: 8, cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <img
        src={img} alt={title}
        style={{
          width: 88, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
          opacity: hovered ? 1 : 0.7,
          transition: 'opacity 0.2s',
          WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent 100%)',
          maskImage: 'linear-gradient(to right, black 60%, transparent 100%)',
        }}
      />
      <p style={{
        fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5,
        color: hovered ? 'white' : 'rgba(255,255,255,0.75)',
        transition: 'color 0.15s',
      }}>{title}</p>
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const [mobileSolusiOpen, setMobileSolusiOpen] = useState(false)
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false)
  const menuRef = useRef(null)
  const closeTimer = useRef(null)
  const solCloseTimer = useRef(null)
  const resCloseTimer = useRef(null)

  const openMenu = () => {
    clearTimeout(closeTimer.current)
    setSolutionsOpen(false)
    setResourcesOpen(false)
    setMenuOpen(true)
  }

  const closeMenu = () => {
    closeTimer.current = setTimeout(() => setMenuOpen(false), 120)
  }

  const openSolutions = () => {
    clearTimeout(solCloseTimer.current)
    setMenuOpen(false)
    setResourcesOpen(false)
    setSolutionsOpen(true)
  }

  const closeSolutions = () => {
    solCloseTimer.current = setTimeout(() => setSolutionsOpen(false), 120)
  }

  const openResources = () => {
    clearTimeout(resCloseTimer.current)
    setMenuOpen(false)
    setSolutionsOpen(false)
    setResourcesOpen(true)
  }

  const closeResources = () => {
    resCloseTimer.current = setTimeout(() => setResourcesOpen(false), 120)
  }

  const closeAll = () => {
    closeMenu(); closeSolutions(); closeResources()
  }

  const menuColumns = [
    {
      label: 'BUILD AI',
      items: [
        { icon: <Box size={20} />, title: 'Agent Studio', desc: 'Build AI agents via a single prompt', slug: 'agent-studio' },
        { icon: <Blocks size={20} />, title: 'Microservices APIs', desc: 'Autofill, Website Tester & Feature Sharing', slug: 'microservices' },
        { icon: <Zap size={20} />, title: 'Fine-Tuning & RLHF', desc: 'Adapt foundation models to your data', slug: 'fine-tuning' },
      ]
    },
    {
      label: 'DEPLOY AI',
      items: [
        { icon: <Lock size={20} />, title: 'On-Premise Private Cloud', desc: 'Zero cloud dependency for sensitive sectors', slug: 'on-premise' },
        { icon: <Network size={20} />, title: 'MCP Bridge', desc: 'Connect legacy databases to modern LLMs', slug: 'mcp-bridge' },
      ]
    },
    {
      label: 'INTELLIGENT AI',
      items: [
        { icon: <Cpu size={20} />, title: 'Multimodal Inference', desc: 'Gemma-2b + Projection Adapter by Fira', slug: 'multimodal' },
        { icon: <Target size={20} />, title: 'Model Evaluation', desc: 'Benchmark and red-team AI outputs', slug: 'model-evaluation' },
        { icon: <Database size={20} />, title: 'Enterprise Data Engine', desc: 'Long-term strategic data differentiation', slug: 'data-engine' },
      ]
    },
  ]

  return (
    <>
      <nav className="navbar" ref={menuRef} onMouseLeave={closeMenu}>
        <div className="navbar-content flex-between">
          <div className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Logo size={36} />
            <span>Amadeus AI</span>
          </div>
          
          <div className="nav-links">
            <button
              onMouseEnter={openMenu}
              className="nav-link"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                color: menuOpen ? 'white' : undefined
              }}
            >
              Products <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            <button
              onMouseEnter={openSolutions}
              className="nav-link"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                color: solutionsOpen ? 'white' : undefined
              }}
            >
              Solusi <ChevronDown size={14} style={{ transform: solutionsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            <a href="#customers" className="nav-link" onMouseEnter={closeAll}>Customers</a>
            <button
              onMouseEnter={openResources}
              className="nav-link"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                color: resourcesOpen ? 'white' : undefined
              }}
            >
              Resources <ChevronDown size={14} style={{ transform: resourcesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>

          <div className="nav-actions flex-center" style={{ gap: '16px' }} onMouseEnter={closeAll}>
            <button onClick={() => navigate('/login')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Log In</button>
            <button className="btn-primary" onClick={() => navigate('/book-demo')}>Book a Demo</button>
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: '72px', left: 0, right: 0,
                background: 'rgba(8,8,10,0.98)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '24px 24px 32px 24px', display: 'flex', flexDirection: 'column', gap: '24px',
                zIndex: 150, overflowY: 'auto', maxHeight: '80vh'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Products */}
                <div>
                  <div onClick={() => setMobileProductsOpen(!mobileProductsOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500, fontSize: '1.05rem', color: 'white', cursor: 'pointer' }}>
                    Products <ChevronDown size={18} style={{ transform: mobileProductsOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </div>
                  <AnimatePresence>
                    {mobileProductsOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', paddingLeft: '12px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {menuColumns.flatMap(col => col.items).map(item => (
                          <div key={item.title} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => { setMobileMenuOpen(false); navigate(`/product/${item.slug}`) }}>{item.title}</div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Solusi */}
                <div>
                  <div onClick={() => setMobileSolusiOpen(!mobileSolusiOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500, fontSize: '1.05rem', color: 'white', cursor: 'pointer' }}>
                    Solusi <ChevronDown size={18} style={{ transform: mobileSolusiOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </div>
                  <AnimatePresence>
                    {mobileSolusiOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', paddingLeft: '12px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {['Pemerintahan', 'Sektor Publik Global', 'Pendidikan', 'Perusahaan Swasta', 'Universitas'].map(title => (
                          <div key={title} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => setMobileMenuOpen(false)}>{title}</div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <a href="#customers" style={{ fontWeight: 500, fontSize: '1.05rem', color: 'white' }} onClick={() => setMobileMenuOpen(false)}>Customers</a>
                
                {/* Resources */}
                <div>
                  <div onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500, fontSize: '1.05rem', color: 'white', cursor: 'pointer' }}>
                    Resources <ChevronDown size={18} style={{ transform: mobileResourcesOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </div>
                  <AnimatePresence>
                    {mobileResourcesOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', paddingLeft: '12px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {['About Us', 'Security', 'Documentation', 'Blog', 'Case Studies', 'Careers', 'Events', 'Contact Us'].map(title => (
                          <div key={title} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => setMobileMenuOpen(false)}>{title}</div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button onClick={() => { setMobileMenuOpen(false); navigate('/login') }} className="btn-outline" style={{ width: '100%', textAlign: 'center', padding: '12px', cursor: 'pointer' }}>Log In</button>
                <button onClick={() => { setMobileMenuOpen(false); navigate('/book-demo') }} className="btn-primary" style={{ width: '100%', textAlign: 'center', padding: '12px', cursor: 'pointer' }}>Book a Demo</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mega Menu Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              onMouseEnter={openMenu}
              onMouseLeave={closeMenu}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0, right: 0,
                background: 'rgba(8,8,10,0.97)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '36px 60px 40px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 40,
                zIndex: 200,
              }}
            >
              {menuColumns.map((col) => (
                <div key={col.label}>
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 600,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 20,
                  }}>{col.label}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {col.items.map((item) => (
                      <MegaMenuItem key={item.title} icon={item.icon} title={item.title} desc={item.desc} onClick={() => { setMenuOpen(false); navigate(`/product/${item.slug}`) }} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Solutions Dropdown */}
        <AnimatePresence>
          {solutionsOpen && (
            <motion.div
              onMouseEnter={openSolutions}
              onMouseLeave={closeSolutions}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '100%', left: 0, right: 0,
                background: 'rgba(8,8,10,0.97)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '36px 60px 40px',
                zIndex: 200,
              }}
            >
              <p style={{
                fontSize: '0.7rem', fontWeight: 600,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)', marginBottom: 24
              }}>SOLUSI</p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 320px))',
                gap: '4px 40px'
              }}>
                {[
                  { icon: <Shield size={22} />, title: 'Pemerintahan', desc: 'AI patuh regulasi bagi lembaga publik' },
                  { icon: <Layers size={22} />, title: 'Sektor Publik Global', desc: 'AI terukur bagi institusi internasional' },
                  { icon: <Logo size={22} />, title: 'Pendidikan', desc: 'Alat cerdas untuk platform pembelajaran' },
                  { icon: <Database size={22} />, title: 'Perusahaan Swasta', desc: 'Deployment AI privat kelas korporasi' },
                  { icon: <Target size={22} />, title: 'Universitas', desc: 'Infrastruktur AI siap riset untuk akademisi' },
                ].map((item) => (
                  <SolutionItem
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    desc={item.desc}
                    onClick={() => setSolutionsOpen(false)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Resources Dropdown */}
        <AnimatePresence>
          {resourcesOpen && (
            <motion.div
              onMouseEnter={openResources}
              onMouseLeave={closeResources}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '100%', left: 0, right: 0,
                background: 'rgba(8,8,10,0.97)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '36px 60px 40px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0 60px',
                zIndex: 200,
              }}
            >
              {/* Left — Links */}
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>IN AMADEUS</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                  {[
                    { icon: <Logo size={18} />, label: 'About Us' },
                    { icon: <Shield size={18} />, label: 'Security' },
                    { icon: <Code2 size={18} />, label: 'Documentation' },
                    { icon: <Layers size={18} />, label: 'Blog' },
                    { icon: <Database size={18} />, label: 'Case Studies' },
                    { icon: <Zap size={18} />, label: 'Careers' },
                    { icon: <Target size={18} />, label: 'Events' },
                    { icon: <Network size={18} />, label: 'Contact Us' },
                  ].map((item) => (
                    <ResourceLink key={item.label} icon={item.icon} label={item.label} onClick={() => setResourcesOpen(false)} />
                  ))}
                </div>
              </div>

              {/* Right — Blog Posts */}
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>FEATURED BLOG POSTS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <BlogCard
                    img="/blog1.png"
                    title="Introducing MCP Connectors: The Missing Bridge Between Enterprise Data and AI Trust"
                    onClick={() => setResourcesOpen(false)}
                  />
                  <BlogCard
                    img="/blog2.png"
                    title="Amadeus AI and On-Premise Deployment — Securing AI for Finance, Legal & Healthcare"
                    onClick={() => setResourcesOpen(false)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main>
        <section className="hero" style={{ position: 'relative', overflow: 'hidden', padding: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            <ShaderAnimation />
          </div>
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}>
            <DigitalSerenityHero>
              <motion.div 
                className="hero-actions flex-center"
                style={{ justifyContent: 'center', flexWrap: 'wrap', gap: '16px' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 2, ease: "easeOut" }}
              >
                <button className="btn-outline flex-center" onClick={() => navigate('/book-demo')} style={{ gap: '8px', padding: '10px 20px', borderRadius: '24px', cursor: 'pointer', position: 'relative', zIndex: 20 }}>
                  Book a Demo <ChevronRight size={14} />
                </button>
                <button className="btn-text flex-center" style={{ gap: '8px', cursor: 'pointer', position: 'relative', zIndex: 20 }}>
                  Build AI <ChevronRight size={14} />
                </button>
              </motion.div>
            </DigitalSerenityHero>
          </div>
        </section>

        <section className="stats">
          <div className="container">
            <div className="stats-grid">
              {[
                { val: "10B+", label: "Annotations Completed" },
                { val: "99.9%", label: "Quality SLA Guarantee" },
                { val: "50+", label: "Supported Modalities" },
                { val: "24/7", label: "Global Workforce" }
              ].map((stat, i) => (
                <FadeInScroll key={i} delay={i * 0.1}>
                  <div className="heading-lg accent-gradient">{stat.val}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{stat.label}</div>
                </FadeInScroll>
              ))}
            </div>
          </div>
        </section>

        <section className="features container">
          <FadeInScroll>
            <h2 className="heading-lg" style={{ textAlign: 'center', marginBottom: '16px' }}>Platform Amadeus AI</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Ekosistem lengkap yang dirancang untuk membangun, mengamankan, dan meluncurkan agen cerdas di seluruh perusahaan Anda.
            </p>
          </FadeInScroll>

          <div className="features-grid">
            <FadeInScroll delay={0.1}>
              <div className="feature-card">
                <div className="feature-icon"><Logo size={24} /></div>
                <h3 className="feature-title heading-md">Agent Studio (PaaS)</h3>
                <p className="feature-desc">Amadeus menyediakan antarmuka terpadu untuk membangun, meluncurkan, dan mengelola agen AI melalui satu perintah prompt.</p>
              </div>
            </FadeInScroll>
            
            <FadeInScroll delay={0.2}>
              <div className="feature-card">
                <div className="feature-icon"><Shield size={24} /></div>
                <h3 className="feature-title heading-md">Privasi Lokal</h3>
                <p className="feature-desc">Dirancang untuk berjalan 100% secara lokal. Infrastruktur privat yang aman bagi sektor perbankan, hukum, dan medis yang melarang transfer data eksternal.</p>
              </div>
            </FadeInScroll>
            
            <FadeInScroll delay={0.3}>
              <div className="feature-card">
                <div className="feature-icon"><Code2 size={24} /></div>
                <h3 className="feature-title heading-md">Layanan Mikro Spesifik</h3>
                <p className="feature-desc">API modular yang mencakup <b>Pengisian Otomatis Bidang Agen</b>, <b>Penguji Situs Web</b>, dan <b>Layanan Berbagi Fitur</b> untuk protokol kemampuan antar-agen.</p>
              </div>
            </FadeInScroll>
            
            <FadeInScroll delay={0.4}>
              <div className="feature-card">
                <div className="feature-icon"><Database size={24} /></div>
                <h3 className="feature-title heading-md">Konektor MCP</h3>
                <p className="feature-desc">Memanfaatkan Model Context Protocol untuk menghubungkan basis data internal dengan model modern.</p>
              </div>
            </FadeInScroll>

          </div>
        </section>

        <section className="container" style={{ padding: '80px 24px', marginBottom: '80px' }}>
          <FadeInScroll>
            <h2 className="heading-lg" style={{ marginBottom: '12px' }}>Kapabilitas Platform</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '60px', maxWidth: '500px' }}>
              Mulai dari peluncuran lokal hingga inteligensi multimodal — semuanya dalam satu sistem terpadu.
            </p>
          </FadeInScroll>

          <div className="grid-2-col" style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

              {[
                {
                  num: '01',
                  title: 'Fine-Tuning dan RLHF',
                  desc: 'Adaptasikan model dasar ke data perusahaan Anda. Sediakan asisten AI kustom tanpa keahlian pemrograman, didukung oleh RLHF untuk peningkatan kualitas yang berkelanjutan.'
                },
                {
                  num: '02',
                  title: 'Infrastruktur Lokal',
                  desc: 'Beroperasi 100% secara lokal tanpa ketergantungan cloud. Sangat ideal untuk sektor perbankan, hukum, dan kesehatan yang membutuhkan privasi data mutlak.'
                },
                {
                  num: '03',
                  title: 'Rangkaian API Layanan Mikro',
                  desc: 'Luncurkan API modular seperti Pengisian Otomatis Bidang Agen dan Penguji Situs Web. Memungkinkan berbagi kemampuan antar-agen dengan lancar dalam ekosistem perusahaan Anda.'
                },
                {
                  num: '04',
                  title: 'MCP Bridge & Integrasi',
                  desc: 'Hubungkan basis data lama ke LLM modern secara aman melalui MCP.'
                },
              ].map((item, i, arr) => (
                <FadeInScroll key={i} delay={i * 0.12}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '24px', 
                    padding: '28px 0', 
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' 
                  }}>
                    <span style={{ 
                      color: 'var(--accent-purple)', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      letterSpacing: '0.1em',
                      opacity: 0.7,
                      minWidth: '28px',
                      paddingTop: '4px'
                    }}>{item.num}</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '10px', color: 'white' }}>{item.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.9rem' }}>{item.desc}</p>
                    </div>
                  </div>
                </FadeInScroll>
              ))}
            </div>

            <FadeInScroll delay={0.4} className="flex-center mobile-static" style={{ height: '100%', position: 'sticky', top: '100px' }}>
              <motion.img 
                src="/pillars.png" 
                alt="Pilar Arsitektur AI"
                style={{ 
                  width: '100%', 
                  maxWidth: '700px', 
                  objectFit: 'contain',
                  WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)',
                  maskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)'
                }}
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
              />
            </FadeInScroll>
          </div>
        </section>

        <section className="container">
          <div className="code-section">
            <FadeInScroll delay={0.1}>
            <h2 className="heading-lg" style={{ marginBottom: '24px' }}>API yang Ramah Pengembang</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Integrasikan langsung ke dalam alur kerja ML Anda dengan SDK kami yang intuitif. Otomatiskan siklus hidup data Anda hanya dengan beberapa baris kode.
            </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                  <Code2 className="accent-gradient" />
                  <span>SDK untuk Python, Node.js, dan Golang</span>
                </div>
                <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                  <Zap className="accent-gradient" />
                  <span>Pemrosesan Asinkron dengan Throughput Tinggi</span>
                </div>
              </div>
            </FadeInScroll>
            
            <FadeInScroll delay={0.3}>
              <div className="code-window">
                <div className="code-header">
                  <div className="code-dot red"></div>
                  <div className="code-dot yellow"></div>
                  <div className="code-dot green"></div>
                  <span style={{ marginLeft: '12px', color: '#6d6d75', fontSize: '0.8rem' }}>pipeline.py</span>
                </div>
                <div className="code-content">
                  <span style={{ color: '#c678dd' }}>import</span> amadeus<br/><br/>
                  <span style={{ color: '#5c6370' }}># Inisialisasi Agent Studio PaaS</span><br/>
                  agent = amadeus.Agent(<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;prompt=<span style={{ color: '#98c379' }}>"Bangun asisten riset hukum"</span>,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;mode=<span style={{ color: '#98c379' }}>"on-premise"</span>,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;mcp_connector=<span style={{ color: '#98c379' }}>"internal_legal_db"</span><br/>
                  )<br/><br/>
                  <span style={{ color: '#5c6370' }}># Luncurkan dengan dukungan visi multimodal</span><br/>
                  agent.deploy(vision_adapter=<span style={{ color: '#d19a66' }}>True</span>)<br/><br/>
                  <span style={{ color: '#61afef' }}>print</span>(<span style={{ color: '#98c379' }}>f"Agen aktif di: </span><span style={{ color: '#e5c07b' }}>{"{"}</span>agent.endpoint<span style={{ color: '#e5c07b' }}>{"}"}</span><span style={{ color: '#98c379' }}>"</span>)
                </div>
              </div>
            </FadeInScroll>
          </div>
        </section>

        <section className="container" style={{ padding: '40px 0 100px', borderTop: '1px solid var(--border-color)' }}>
          <FadeInScroll>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '40px' }}>
              Dibangun di atas fondasi industri terkemuka
            </p>
            <div className="flex-between" style={{ opacity: 0.5, filter: 'grayscale(1)', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
               <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>GOOGLE</span>
               <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>META</span>
               <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>ANTHROPIC</span>
               <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>COHERE</span>
               <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>MISTRAL</span>
            </div>
          </FadeInScroll>
        </section>

        <section style={{ background: 'linear-gradient(to bottom, transparent, rgba(139, 92, 246, 0.05))', padding: '120px 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <FadeInScroll>
              <h2 className="heading-lg" style={{ marginBottom: '24px' }}>Siap Mengeskalasi AI Anda?</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 40px' }}>
                Bergabunglah dengan berbagai perusahaan terkemuka yang sedang membangun masa depan inteligensi otonom bersama Amadeus AI.
              </p>
              <div className="flex-center" style={{ gap: '16px' }}>
                <button className="btn-primary" style={{ padding: '14px 32px', borderRadius: '30px', fontSize: '1rem' }} onClick={() => navigate('/book-demo')}>Mulai Sekarang</button>
                <button className="btn-outline" style={{ padding: '14px 32px', borderRadius: '30px', fontSize: '1rem' }}>Hubungi Penjualan</button>
              </div>
            </FadeInScroll>
          </div>
        </section>

        <section id="customers" style={{ padding: '100px 0', borderTop: '1px solid var(--border-color)' }}>
          <div className="container">
            <FadeInScroll>
              <h2 className="heading-lg" style={{ textAlign: 'center', marginBottom: '16px' }}>Kisah Sukses Pelanggan</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 60px' }}>
                Dengarkan bagaimana pemimpin industri dalam AI memanfaatkan Amadeus untuk mempercepat peluncuran model cerdas mereka secara aman.
              </p>
            </FadeInScroll>
            
            <FadeInScroll delay={0.2}>
              <CircularTestimonials
                testimonials={[
                  {
                    quote: "Amadeus AI telah mengubah seluruh infrastruktur data kami. Penerapan secara on-premise memastikan keamanan data klinis privat kami sambil memberikan kapabilitas multimodal tercanggih yang sangat andal.",
                    name: "Dr. Sarah Chen",
                    designation: "Chief Data Officer, Nova Health",
                    src: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=600&auto=format&fit=crop"
                  },
                  {
                    quote: "Integrasi Bridge MCP menghubungkan database lama kami yang berumur belasan tahun dengan model LLM modern tanpa hambatan sedikitpun. Agen otonom dari Amadeus telah menghemat ribuan jam rekayasa per kuartal.",
                    name: "Marcus Thorne",
                    designation: "VP of Engineering, GlobalTech",
                    src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=600&auto=format&fit=crop"
                  },
                  {
                    quote: "Menggunakan Fine-Tuning pada kasus hukum kepemilikan khusus dengan RLHF Amadeus menjadikan AI internal kami menjadi sangat akurat. Hal ini telah menjadi titik balik besar bagi produktivitas di seluruh lapisan firma.",
                    name: "Elena Rodriguez",
                    designation: "Managing Partner, Rodriguez & Co",
                    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop"
                  }
                ]}
              />
            </FadeInScroll>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content flex-between">
          <div>
            <div className="nav-logo footer-logo">
              <Logo size={24} />
              <span>Amadeus AI</span>
            </div>
            <div className="footer-text hide-on-mobile" style={{ maxWidth: '300px' }}>
              Menggerakkan siklus hidup data bagi tim AI dan Machine Learning terkemuka di seluruh dunia.
            </div>
          </div>
          <div className="footer-links-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <strong style={{ color: 'white', marginBottom: '8px' }}>Platform</strong>
              <a href="#" className="nav-link">Kurasi Data</a>
              <a href="#" className="nav-link">RLHF</a>
              <a href="#" className="nav-link">Evaluasi Model</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <strong style={{ color: 'white', marginBottom: '8px' }}>Perusahaan</strong>
              <a href="#" className="nav-link">Tentang Kami</a>
              <a href="#" className="nav-link">Karir</a>
              <a href="#" className="nav-link">Kontak</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom flex-between" style={{ maxWidth: '1200px', margin: '40px auto 0', color: 'var(--text-secondary)', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <span>© 2026 Amadeus AI. <span className="hide-on-mobile">Seluruh hak cipta dilindungi undang-undang.</span></span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="#">Kebijakan Privasi</a>
            <a href="#">Ketentuan Layanan</a>
          </div>
        </div>
      </footer>
    </>
  )
}

export default App
