import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from './components/Logo'

// Recreating the animated input with radial gradient border effect
const AppInput = ({ label, placeholder, type = 'text', ...rest }) => {
  const [mouseX, setMouseX] = useState(0)
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouseX(e.clientX - rect.left)
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type={type}
          placeholder={placeholder}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            position: 'relative',
            zIndex: 10,
            border: '1.5px solid rgba(255,255,255,0.12)',
            height: '48px',
            width: '100%',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            padding: '0 16px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            color: 'white',
            outline: 'none',
            fontSize: '0.9rem',
            boxSizing: 'border-box',
            transition: 'background 0.2s',
          }}
          onFocus={e => e.target.style.background = 'rgba(255,255,255,0.07)'}
          onBlur={e => e.target.style.background = 'rgba(255,255,255,0.04)'}
          {...rest}
        />
        {/* Radial gradient top border on hover */}
        {isHovering && (
          <>
            <div style={{
              position: 'absolute', pointerEvents: 'none',
              top: 0, left: 0, right: 0, height: 2, zIndex: 20,
              borderRadius: '8px 8px 0 0', overflow: 'hidden',
              background: `radial-gradient(40px circle at ${mouseX}px 0px, rgba(139,92,246,1) 0%, transparent 70%)`,
            }} />
            <div style={{
              position: 'absolute', pointerEvents: 'none',
              bottom: 0, left: 0, right: 0, height: 2, zIndex: 20,
              borderRadius: '0 0 8px 8px', overflow: 'hidden',
              background: `radial-gradient(40px circle at ${mouseX}px 2px, rgba(139,92,246,0.6) 0%, transparent 70%)`,
            }} />
          </>
        )}
      </div>
    </div>
  )
}

// Social icon button with fill-up hover effect
const SocialBtn = ({ icon, href = '#' }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <a href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 44, height: 44,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer', textDecoration: 'none',
        color: 'rgba(255,255,255,0.7)',
        transition: 'color 0.3s',
      }}>
      {/* fill-up overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        transform: hovered ? 'scaleY(1)' : 'scaleY(0)',
        transformOrigin: 'bottom',
        transition: 'transform 0.4s ease',
        zIndex: 1,
      }} />
      <span style={{ position: 'relative', zIndex: 2, display: 'flex' }}>{icon}</span>
    </a>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const socialIcons = [
    // Instagram
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"/></svg>,
    // LinkedIn
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6.94 5a2 2 0 1 1-4-.002a2 2 0 0 1 4 .002M7 8.48H3V21h4zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91z"/></svg>,
    // Facebook
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396z"/></svg>,
  ]

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: '#050505',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: "'Inter', sans-serif",
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
      backgroundSize: '50px 50px',
    }}>
      {/* Logo */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 64, display: 'flex', alignItems: 'center',
        padding: '0 40px', zIndex: 100,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', color: 'white' }}>
          <Logo size={24} />
          Amadeus AI
        </div>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 900,
          height: 580,
          display: 'flex',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* LEFT — Form */}
        <div
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            width: '50%', height: '100%',
            background: 'rgba(10,10,12,0.95)',
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '48px 40px',
            boxSizing: 'border-box',
          }}
        >
          {/* Mouse-tracking glow */}
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(59,130,246,0.1) 40%, transparent 70%)',
            transform: `translate(${mousePos.x - 250}px, ${mousePos.y - 250}px)`,
            transition: 'transform 0.1s ease-out',
            opacity: isHovering ? 1 : 0,
            zIndex: 0,
          }} />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8, color: 'white', letterSpacing: '-0.02em' }}>
              Masuk
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: 28 }}>
              Akses dasbor Amadeus AI Anda
            </p>

            {/* Social icons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {socialIcons.map((icon, i) => (
                <SocialBtn key={i} icon={icon} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>atau gunakan akun Anda</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
              <AppInput placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <AppInput placeholder="Kata Sandi" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            <a href="#" style={{ display: 'block', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginBottom: 28, textDecoration: 'none' }}>
              Lupa kata sandi Anda?
            </a>

            {/* Sign In button with shimmer */}
            <SignInButton />

            <p style={{ marginTop: 20, fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
              Belum memiliki akun?{' '}
              <span onClick={() => navigate('/book-demo')}
                style={{ color: '#8b5cf6', cursor: 'pointer', textDecoration: 'underline' }}>
                Reservasi Demo
              </span>
            </p>
          </div>
        </div>

        {/* RIGHT — Image */}
        <div style={{ width: '50%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <img
            src="/building.png"
            alt="Amadeus AI Enterprise"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: 0.35,
              transform: 'scale(1.05)',
              filter: 'grayscale(20%) contrast(1.1)',
            }}
          />
          {/* Overlay gradient left */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(10,10,12,1) 0%, rgba(10,10,12,0.4) 40%, transparent 100%)',
          }} />
          {/* Overlay gradient bottom */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(10,10,12,0.8) 0%, transparent 50%)',
          }} />
          {/* Text overlay */}
          <div style={{
            position: 'absolute', bottom: 36, left: 32, right: 32,
          }}>
            <p style={{ fontSize: '1rem', fontWeight: 300, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontStyle: 'italic' }}>
              "Masa depan AI perusahaan bersifat privat, cerdas, dan mandiri."
            </p>
            <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600 }}>Platform Amadeus AI</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Shimmer button
function SignInButton() {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: 'none',
        background: 'rgba(139,92,246,0.25)',
        padding: '11px 40px',
        color: 'white', fontWeight: 500, fontSize: '0.95rem',
        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 0 24px rgba(139,92,246,0.4)' : 'none',
        width: '100%',
      }}
    >
      <span style={{ position: 'relative', zIndex: 2 }}>Masuk</span>
      {/* Shimmer sweep */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        width: 32,
        background: 'rgba(255,255,255,0.2)',
        transform: `skewX(-13deg) translateX(${hovered ? '300px' : '-100px'})`,
        transition: hovered ? 'transform 0.7s ease' : 'none',
        zIndex: 1,
      }} />
    </button>
  )
}
