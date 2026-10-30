"use client";

import { motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import ProductCard from "@/components/ProductCard";

/**
 * Products grid section on the home page.
 * Receives the serialized product list from the home server component.
 */
export default function ProductsSection({ products = [] }) {
  const visible = products.filter((p) => p.available);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8" id="products">
      <Reveal>
        <div className="section-heading">
          <h2>
            Our <span className="text-gradient">Products</span>
          </h2>
          <p>
            Hand-picked digital products, tested and delivered within minutes of
            purchase.
          </p>
        </div>
      </Reveal>

      {visible.length === 0 ? (
        <Reveal delay={0.15}>
          <div className="glass mt-10 p-14 text-center">
            <div className="text-5xl">🛒</div>
            <h3 className="mt-4 font-display text-xl font-bold text-white">
              No products listed yet
            </h3>
            <p className="mt-2 text-slate-400">
              New drops are coming soon — join the Discord to get notified
              first.
            </p>
          </div>
        </Reveal>
      ) : (
        <motion.div
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {visible.map((product, i) => (
            <ProductCard key={product._id} product={product} index={i} />
          ))}
        </motion.div>
      )}
    </section>
  );
}
