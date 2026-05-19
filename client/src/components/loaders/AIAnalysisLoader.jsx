import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import './AIAnalysisLoader.css';

const SCAN_PHASES = [
  'Initialization',
  'Performance Scan',
  'SEO Analysis',
  'Accessibility Review',
  'Security Check',
  'Report Compilation'
];

const STATUS_MESSAGES = [
  'Initializing AI engines...',
  'Establishing secure scan tunnel...',
  'Running Lighthouse diagnostics...',
  'Analyzing performance bottlenecks...',
  'Detecting SEO optimization issues...',
  'Reviewing accessibility standards...',
  'Evaluating security headers...',
  'Generating optimization insights...',
  'Compiling final intelligence report...'
];

const pad = (value) => String(value).padStart(2, '0');

const formatElapsed = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

const extractDomain = (targetUrl) => {
  if (!targetUrl) {
    return 'Preparing target...';
  }

  try {
    const normalized = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
    return new URL(normalized).hostname;
  } catch {
    return targetUrl;
  }
};

const getPhaseIndex = (progress) => Math.min(
  SCAN_PHASES.length - 1,
  Math.floor((progress / 100) * SCAN_PHASES.length)
);

const getNextProgress = (value) => {
  if (value >= 96) {
    return value;
  }

  if (value < 18) {
    return Math.min(value + 1.8, 18);
  }

  if (value < 42) {
    return Math.min(value + 1.25, 42);
  }

  if (value < 68) {
    return Math.min(value + 0.8, 68);
  }

  if (value < 84) {
    return Math.min(value + 0.5, 84);
  }

  return Math.min(value + 0.18, 96);
};

const phaseCaptions = {
  Initialization: 'Booting the analysis stack and validating the target.',
  'Performance Scan': 'Collecting load-time and rendering intelligence.',
  'SEO Analysis': 'Inspecting metadata, structure, and discoverability.',
  'Accessibility Review': 'Reviewing usability and inclusive experience signals.',
  'Security Check': 'Checking transport, headers, and trust indicators.',
  'Report Compilation': 'Combining findings into one structured AI report.'
};

export const AIAnalysisLoader = memo(({ targetUrl = '' }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState(4);
  const [messageIndex, setMessageIndex] = useState(0);
  const cardRef = useRef(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 160, damping: 20, mass: 0.8 });
  const springRotateY = useSpring(rotateY, { stiffness: 160, damping: 20, mass: 0.8 });
  const scannerY = useTransform(springRotateX, [-10, 10], [8, -8]);
  const domain = useMemo(() => extractDomain(targetUrl), [targetUrl]);
  const activePhaseIndex = getPhaseIndex(progress);
  const currentMessage = STATUS_MESSAGES[messageIndex];

  useEffect(() => {
    const elapsedInterval = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    const progressInterval = window.setInterval(() => {
      setProgress((previous) => getNextProgress(previous));
    }, 180);

    const messageInterval = window.setInterval(() => {
      setMessageIndex((previous) => (previous + 1) % STATUS_MESSAGES.length);
    }, 2400);

    return () => {
      window.clearInterval(elapsedInterval);
      window.clearInterval(progressInterval);
      window.clearInterval(messageInterval);
    };
  }, []);

  const handleMouseMove = (event) => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const percentX = offsetX / rect.width;
    const percentY = offsetY / rect.height;

    rotateY.set((percentX - 0.5) * 10);
    rotateX.set((0.5 - percentY) * 10);
    card.style.setProperty('--pointer-x', `${percentX * 100}%`);
    card.style.setProperty('--pointer-y', `${percentY * 100}%`);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);

    const card = cardRef.current;
    if (card) {
      card.style.setProperty('--pointer-x', '50%');
      card.style.setProperty('--pointer-y', '50%');
    }
  };

  return (
    <motion.section
      className="ai-analysis-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="ai-analysis-loader__ambient" />

      <motion.div
        ref={cardRef}
        className="ai-analysis-loader__card"
        style={{ rotateX: springRotateX, rotateY: springRotateY }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.45, ease: 'easeOut' }
        }}
      >
        <motion.div
          className="ai-analysis-loader__surface"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="ai-analysis-loader__grid">
            <div>
              <div className="ai-analysis-loader__header">
                <div className="ai-analysis-loader__badge">
                  <Sparkles size={16} />
                  AI analysis in progress
                </div>
              </div>

              <h1 className="ai-analysis-loader__title">Generating your SiteGrade report</h1>
              <p className="ai-analysis-loader__subtitle">
                We are running a multi-stage intelligence pass across performance, SEO, accessibility,
                security, and optimization quality signals.
              </p>

              <div className="ai-analysis-loader__meta">
                <div className="ai-analysis-loader__meta-item">
                  <span className="ai-analysis-loader__meta-label">Elapsed Time</span>
                  <span className="ai-analysis-loader__meta-value">{formatElapsed(elapsedSeconds)}</span>
                </div>
                <div className="ai-analysis-loader__meta-item">
                  <span className="ai-analysis-loader__meta-label">Current Target</span>
                  <span className="ai-analysis-loader__meta-value">{domain}</span>
                </div>
              </div>

              <div className="ai-analysis-loader__progress-shell">
                <div className="ai-analysis-loader__progress-header">
                  <span className="ai-analysis-loader__progress-label">{SCAN_PHASES[activePhaseIndex]}</span>
                  <span className="ai-analysis-loader__progress-value">{Math.round(progress)}%</span>
                </div>

                <div className="ai-analysis-loader__progress-track">
                  <motion.div
                    className="ai-analysis-loader__progress-fill"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.35 }}
                  >
                    <div className="ai-analysis-loader__progress-shine" />
                  </motion.div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMessage}
                    className="ai-analysis-loader__status"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    {currentMessage}
                    <span className="ai-analysis-loader__dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div>
              <div className="ai-analysis-loader__scanner-wrap">
                <div className="ai-analysis-loader__scanner-halo" />
                <motion.div
                  className="ai-analysis-loader__scanner"
                  style={{ y: scannerY }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="ai-analysis-loader__scanner-grid" />
                  <motion.div
                    className="ai-analysis-loader__scanline"
                    animate={{ y: ['-52%', '52%', '-52%'] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="ai-analysis-loader__scanner-core" />
                  <div className="ai-analysis-loader__scanner-pulse" />
                  <motion.div
                    className="ai-analysis-loader__scanner-core"
                    style={{ width: '14%', opacity: 0.65 }}
                    animate={{ scale: [1, 1.22, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </div>

              <div className="ai-analysis-loader__domain">
                <div className="ai-analysis-loader__domain-label">Analyzing Now</div>
                <div className="ai-analysis-loader__domain-value">{domain}</div>
              </div>

              <div className="ai-analysis-loader__phase-list" style={{ marginTop: '1.5rem' }}>
                {SCAN_PHASES.map((phase, index) => {
                  const isActive = index === activePhaseIndex;
                  const isComplete = index < activePhaseIndex;
                  const className = [
                    'ai-analysis-loader__phase-card',
                    isActive ? 'ai-analysis-loader__phase-card--active' : '',
                    isComplete ? 'ai-analysis-loader__phase-card--complete' : ''
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={phase} className={className}>
                      <div className="ai-analysis-loader__phase-indicator" />
                      <div className="ai-analysis-loader__phase-text">
                        <span className="ai-analysis-loader__phase-name">{phase}</span>
                        <span className="ai-analysis-loader__phase-caption">{phaseCaptions[phase]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
});

AIAnalysisLoader.displayName = 'AIAnalysisLoader';
