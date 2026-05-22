import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import Logo from './components/Logo'

const services = [
  'Agent Studio & Asisten AI Kustom',
  'Deployment Privat Lokal (On-Premise)',
  'RLHF & Fine-Tuning Model Dasar',
  'Integrasi Basis Data MCP',
  'API Layanan Mikro (Autofill, Tester, Sharing)',
  'Lisensi Inferensi Multimodal',
]

const testimonial = {
  quote: "Kita akan membutuhkan jauh lebih banyak investasi dalam infrastruktur AI dan data berkualitas tinggi guna memahami utilitas komparatif yang sebenarnya dari berbagai model. Kapabilitas deployment privat Amadeus AI adalah solusi tepat yang kami butuhkan.",
  name: 'Budi Hartono',
  role: 'CTO, Regional Finance Group',
}

const partners = ['GOOGLE', 'META', 'ANTHROPIC', 'COHERE', 'MISTRAL', 'CISCO']

export default function BookDemo() {
  const navigate = useNavigate()
  const [budget, setBudget] = useState('')
  const [selected, setSelected] = useState([])
  const [submitted, setSubmitted] = useState(false)

  const toggleService = (s) =>
    setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
          onClick={() => navigate('/')}>
          <Logo size={24} />
          <span>Amadeus AI</span>
        </div>
        <button onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
          <ArrowLeft size={14} /> Kembali ke Beranda
        </button>
      </nav>

      {/* Main */}
      <div style={{ paddingTop: 96, paddingBottom: 60, maxWidth: 1100, margin: '0 auto', padding: '96px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'flex-start' }}>

        {/* Left — Form */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '40px 36px' }}
        >
          {!submitted ? (
            <>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 500, marginBottom: 12, letterSpacing: '-0.02em' }}>Mari Membangun Bersama</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: 32, lineHeight: 1.6 }}>
                Bergabunglah dengan perusahaan terkemuka yang menggunakan Amadeus AI untuk otomatisasi cerdas dan privat. Reservasi <strong style={{ color: 'white' }}>demo 1:1</strong> bersama tim kami untuk memulai.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input required placeholder="Nama depan*" style={inputStyle} />
                  <input required placeholder="Nama belakang*" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input required placeholder="Nama perusahaan*" style={inputStyle} />
                  <input required placeholder="Jabatan*" style={inputStyle} />
                </div>
                <input required type="email" placeholder="Email kantor*" style={inputStyle} />
                <div style={{ position: 'relative' }}>
                  <select required style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="" disabled selected>Negara*</option>
                    <option>Indonesia</option>
                    <option>Singapura</option>
                    <option>Malaysia</option>
                    <option>Amerika Serikat</option>
                    <option>Lainnya</option>
                  </select>
                  <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5, fontSize: 10 }}>▼</div>
                </div>

                {/* Budget */}
                <div style={{ marginTop: 4 }}>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Anggaran Proyek:*</p>
                  {['<$100k', '$100k–500k', '$500k–1M', '$1M+'].map((b) => (
                    <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer', color: budget === b ? 'white' : 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${budget === b ? '#8b5cf6' : 'rgba(255,255,255,0.2)'}`,
                        background: budget === b ? '#8b5cf6' : 'transparent',
                        flexShrink: 0, transition: 'all 0.2s'
                      }} onClick={() => setBudget(b)} />
                      {b}
                    </label>
                  ))}
                </div>

                {/* Services */}
                <div style={{ marginTop: 4 }}>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Apa yang bisa kami bantu? Pilih semua yang sesuai:*</p>
                  {services.map((s) => {
                    const checked = selected.includes(s)
                    return (
                      <label key={s} onClick={() => toggleService(s)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer', color: checked ? 'white' : 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2,
                          border: `2px solid ${checked ? '#8b5cf6' : 'rgba(255,255,255,0.2)'}`,
                          background: checked ? '#8b5cf6' : 'transparent',
                          transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {checked && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                        </div>
                        {s}
                      </label>
                    )
                  })}
                </div>

                <button type="submit" style={{
                  marginTop: 8,
                  padding: '13px 0', borderRadius: 30, border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white', fontWeight: 600, fontSize: '0.95rem',
                  cursor: 'pointer', transition: 'opacity 0.2s',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  Reservasi Demo Saya →
                </button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', padding: '60px 0' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 20 }}>🎉</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: 12 }}>Permintaan Diterima!</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Tim kami akan menghubungi Anda dalam <strong style={{ color: 'white' }}>1 hari kerja</strong> untuk mengatur jadwal demo Amadeus AI yang dipersonalisasi.
              </p>
              <button onClick={() => navigate('/')} style={{
                marginTop: 32, padding: '12px 28px', borderRadius: 30,
                border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                color: 'white', cursor: 'pointer', fontSize: '0.9rem',
                fontFamily: "'Inter', sans-serif"
              }}>← Kembali ke Beranda</button>
            </motion.div>
          )}
        </motion.div>

        {/* Right — Testimonial + Logos */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
        >
          {/* Testimonial */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '36px 32px' }}>
            <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, fontSize: '0.95rem', marginBottom: 28 }}>
              "{testimonial.quote}"
            </p>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#8b5cf6' }}>{testimonial.name}</p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{testimonial.role}</p>
            </div>
          </div>

          {/* Partner Logos */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '32px 28px' }}>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 28 }}>
              Dipercaya oleh tim AI paling ambisius di dunia
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {partners.map((p) => (
                <div key={p} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em', padding: '12px 0' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { val: '< 24 Jam', label: 'Waktu respon' },
              { val: '100%', label: 'Kapabilitas lokal' },
              { val: 'Gratis', label: 'Sesi demo' },
              { val: 'Fleksibel', label: 'Kontrak tanpa keterikatan' },
            ].map((s) => (
              <div key={s.val} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '18px 16px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'white', marginBottom: 4 }}>{s.val}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: '12px 14px',
  color: 'white',
  fontSize: '0.88rem',
  outline: 'none',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}
