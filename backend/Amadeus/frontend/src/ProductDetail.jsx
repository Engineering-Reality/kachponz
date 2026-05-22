import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import Logo from './components/Logo'
import { products } from './productData'

const FadeInScroll = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.7, delay, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
)

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const product = products[slug]

  if (!product) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>Produk Tidak Ditemukan</h1>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 24px', borderRadius: 24, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            ← Kembali ke Beranda
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 100,
        background: 'rgba(5,5,5,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
          onClick={() => navigate('/')}>
          <Logo size={24} />
          <span>Amadeus AI</span>
        </div>
        <button onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Inter', sans-serif" }}>
          <ArrowLeft size={14} /> Kembali ke Beranda
        </button>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 120, paddingBottom: 40, maxWidth: 1100, margin: '0 auto', padding: '120px 24px 40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <p style={{
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: product.color, marginBottom: 20,
          }}>{product.tagline}</p>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.1 }}>
            {product.title}
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.5)', maxWidth: 600, lineHeight: 1.6, marginBottom: 32 }}>
            {product.heroDesc}
          </p>
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={() => navigate('/book-demo')} style={{
              padding: '12px 28px', borderRadius: 30, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${product.color}, ${product.color}88)`,
              color: 'white', fontWeight: 600, fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Reservasi Demo <ChevronRight size={14} />
            </button>
            <button onClick={() => navigate('/')} style={{
              padding: '12px 28px', borderRadius: 30, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
              color: 'white', fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
            }}>
              Pelajari Lebih Lanjut
            </button>
          </div>
        </motion.div>
      </section>

      {/* Steps - alternating layout */}
      <style>{`
        @media (max-width: 768px) {
          .product-step {
            flex-direction: column !important;
            gap: 24px !important;
            margin-bottom: 60px !important;
          }
          .product-step-col {
            padding: 0 !important;
            width: 100% !important;
          }
          .timeline-dot, .timeline-line {
            display: none !important;
          }
          .step-text {
            text-align: center;
          }
        }
      `}</style>
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 100px', position: 'relative' }}>
        {/* Vertical timeline line */}
        <div className="timeline-line" style={{
          position: 'absolute',
          left: '50%', top: 0, bottom: 0,
          width: 1,
          background: `linear-gradient(to bottom, transparent, ${product.color}33 15%, ${product.color}33 85%, transparent)`,
        }} />

        {product.steps.map((step, i) => {
          const isLeft = i % 2 === 0
          return (
            <FadeInScroll key={i} delay={0.05}>
              <div className="product-step" style={{
                display: 'flex',
                flexDirection: isLeft ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: 0,
                marginBottom: i < product.steps.length - 1 ? 60 : 0,
                position: 'relative',
              }}>
                {/* Image side */}
                <div className="product-step-col" style={{ flex: 1, padding: isLeft ? '0 40px 0 0' : '0 0 0 40px' }}>
                  <motion.div
                    whileInView={{ scale: [0.95, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.08)',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={product.images ? product.images[i] : product.image}
                      alt={step.title}
                      style={{
                        width: '100%', height: 220, objectFit: 'cover',
                        opacity: 0.75,
                        filter: product.images ? 'none' : `hue-rotate(${i * 30}deg)`,
                      }}
                    />
                    {/* Overlay with step number */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.3))`,
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: 20,
                    }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4,
                      }}>{product.subtitle}</span>
                      <span style={{
                        fontSize: '1.2rem', fontWeight: 600, color: 'white',
                      }}>{step.title}</span>
                    </div>
                  </motion.div>
                </div>

                {/* Timeline dot */}
                <div className="timeline-dot" style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: '#050505',
                  border: `2px solid ${product.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: product.color, fontWeight: 700, fontSize: '0.8rem',
                  zIndex: 2,
                  boxShadow: `0 0 20px ${product.color}33`,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Text side */}
                <div className="product-step-col step-text" style={{ flex: 1, padding: isLeft ? '0 0 0 40px' : '0 40px 0 0' }}>
                  <h3 style={{
                    fontSize: '1.35rem', fontWeight: 500, marginBottom: 12,
                    color: 'white', letterSpacing: '-0.01em',
                  }}>
                    <span style={{ color: product.color }}>{step.title.split(' ')[0]}</span>{' '}
                    {step.title.split(' ').slice(1).join(' ')}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </FadeInScroll>
          )
        })}
      </section>

      {/* Bottom CTA */}
      <section style={{
        background: `linear-gradient(to bottom, transparent, ${product.color}08)`,
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        <FadeInScroll>
          <h2 style={{ fontSize: '2rem', fontWeight: 400, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Siap untuk memulai dengan {product.title}?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
            Atur jadwal demo yang dipersonalisasi dan saksikan bagaimana {product.title} dapat mentransformasi alur kerja AI perusahaan Anda.
          </p>
          <button onClick={() => navigate('/book-demo')} style={{
            padding: '14px 36px', borderRadius: 30, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${product.color}, ${product.color}88)`,
            color: 'white', fontWeight: 600, fontSize: '1rem', fontFamily: "'Inter', sans-serif",
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Reservasi Demo <ChevronRight size={16} />
          </button>
        </FadeInScroll>
      </section>
    </div>
  )
}
