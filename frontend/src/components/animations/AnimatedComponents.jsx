import { motion, AnimatePresence } from 'framer-motion';

/**
 * AnimatedPage - Wraps page content with fade/slide animations
 */
export function AnimatedPage({ children, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * AnimatedList - Animates list items staggered
 */
export function AnimatedList({ children, className = '' }) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        staggerChildren: 0.05
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * AnimatedListItem - Individual list item with animation
 */
export function AnimatedListItem({ children, className = '' }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, x: -10 },
                visible: { opacity: 1, x: 0 }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * AnimatedCard - Card with hover lift effect
 */
export function AnimatedCard({ children, className = '', onClick }) {
    return (
        <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={className}
            onClick={onClick}
        >
            {children}
        </motion.div>
    );
}

/**
 * FadeIn - Simple fade in animation
 */
export function FadeIn({ children, delay = 0, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * SlideIn - Slide in from a direction
 */
export function SlideIn({ children, direction = 'left', delay = 0, className = '' }) {
    const variants = {
        left: { x: -20, opacity: 0 },
        right: { x: 20, opacity: 0 },
        up: { y: 20, opacity: 0 },
        down: { y: -20, opacity: 0 },
    };

    return (
        <motion.div
            initial={variants[direction]}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

/**
 * ScaleIn - Scale in from small
 */
export function ScaleIn({ children, delay = 0, className = '' }) {
    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, delay }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
