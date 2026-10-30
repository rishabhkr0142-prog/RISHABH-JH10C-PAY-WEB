"use client";

import { motion } from "framer-motion";

/**
 * Scroll-reveal wrapper — children fade/slide up the first time they
 * enter the viewport. The flexible ingredient behind "scroll animations".
 *
 * <Reveal delay={0.15}> ... </Reveal>
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  once = true,
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
