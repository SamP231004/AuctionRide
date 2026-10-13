'use client';

import { motion } from 'framer-motion';

/** Subtle fade/slide on every navigation within the site shell. */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
