import React from 'react';
import { motion } from 'framer-motion';

type Direction = 'forward' | 'back' | 'fade';

interface PageTransitionProps {
  children: React.ReactNode;
  direction: Direction;
  className?: string;
}

const variants = {
  forward: {
    initial: { x: '40%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-20%', opacity: 0 },
  },
  back: {
    initial: { x: '-40%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '20%', opacity: 0 },
  },
  fade: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
};

const transition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.28,
};

export const PageTransition: React.FC<PageTransitionProps> = ({ children, direction, className = '' }) => {
  const v = variants[direction];
  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={transition}
      className={className}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  );
};
