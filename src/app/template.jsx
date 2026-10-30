"use client";

import { motion } from "framer-motion";

/**
 * Route template — re-mounts on every navigation, so each page fades/slides
 * in smoothly. This is what gives the site its "smooth page transitions".
 */
export default function Template({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
