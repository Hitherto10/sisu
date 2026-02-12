import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function LoadingSpinner({ className, text }) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
            <div className="relative w-12 h-12">
                {/* Outer rotating ring */}
                <motion.div
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/30"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />

                {/* Inner counter-rotating ring */}
                <motion.div
                    className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary/50 border-l-primary/10"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />

                {/* Center pulsing dot */}
                <motion.div
                    className="absolute inset-[35%] rounded-full bg-primary"
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
            {text && (
                <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-medium text-muted-foreground animate-pulse"
                >
                    {text}
                </motion.p>
            )}
        </div>
    );
}
