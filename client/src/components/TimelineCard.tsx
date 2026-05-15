import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface TimelineCardProps {
  entry: {
    id: string;
    content: string;
    createdAt: string;
    media: Array<{
      id: string;
      type: string;
      url: string;
      thumbnail?: string;
    }>;
    milestones: Array<{
      id: string;
      name: string;
      icon?: string;
      color?: string;
    }>;
    creator: {
      nickname: string;
      avatar?: string;
    };
  };
  index: number;
}

export default function TimelineCard({ entry, index }: TimelineCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasMedia = entry.media && entry.media.length > 0;
  const hasMilestones = entry.milestones && entry.milestones.length > 0;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    setStartX(clientX);
    setTranslateX(0);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(translateX) > 50 && hasMedia) {
      if (translateX > 0 && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      } else if (translateX < 0 && currentSlide < entry.media.length - 1) {
        setCurrentSlide(currentSlide + 1);
      }
    }
    setTranslateX(0);
  };

  const getSlideStyle = (slideIndex: number) => {
    let transform = `translateX(${(slideIndex - currentSlide) * 100}%)`;
    let scale = 1;
    let opacity = 1;

    if (isDragging) {
      transform = `translateX(calc(${(slideIndex - currentSlide) * 100}% + ${translateX}px))`;
    } else {
      if (slideIndex === currentSlide - 1) {
        scale = 0.92;
        opacity = 0.6;
      } else if (slideIndex === currentSlide + 1) {
        scale = 0.92;
        opacity = 0.6;
      }
    }

    return {
      transform: `${transform} scale(${scale})`,
      opacity,
    };
  };

  return (
    <motion.div
      className="timeline-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileTap={{ scale: 0.97 }}
    >
      {hasMedia && (
        <div
          className="card-photo"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          <div
            ref={trackRef}
            style={{
              position: 'absolute',
              inset: 0,
              touchAction: 'pan-y',
            }}
          >
            {entry.media.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transition: isDragging
                    ? 'none'
                    : 'transform 0.5s cubic-bezier(.22,.68,.36,1.1), opacity 0.5s ease',
                  ...getSlideStyle(idx),
                }}
              >
                {item.type === 'video' ? (
                  <>
                    <img
                      src={item.thumbnail || item.url}
                      alt=""
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <div className="gallery-video-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="8,5 19,12 8,19" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {entry.media.length > 1 && (
            <>
              <div className="carousel-counter">
                {currentSlide + 1} / {entry.media.length}
              </div>
              <div className="carousel-dots">
                {entry.media.map((_, idx) => (
                  <div
                    key={idx}
                    className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="card-body">
        <p className="card-text">{entry.content}</p>

        <div className="card-footer">
          <span className="card-date">
            {format(new Date(entry.createdAt), 'MM月dd日 HH:mm', {
              locale: zhCN,
            })}
          </span>
          {hasMilestones && (
            <span className="card-tag">
              {entry.milestones[0].icon} {entry.milestones[0].name}
              {entry.milestones.length > 1 &&
                ` +${entry.milestones.length - 1}`}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
