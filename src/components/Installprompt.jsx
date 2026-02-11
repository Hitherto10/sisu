import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { Button } from './ui/button';

export default function Installprompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://');

        setIsStandalone(standalone);

        // Detect iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(iOS);

        // Check if prompt was dismissed recently (within 7 days)
        const dismissedAt = localStorage.getItem('pwa-install-dismissed');
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        if (dismissedAt && parseInt(dismissedAt) > sevenDaysAgo) {
            return;
        }

        // For Android/Desktop - listen for beforeinstallprompt
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // Show prompt after 3 seconds delay for better UX
            setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS - show manual instructions if not installed
        if (iOS && !standalone && !dismissedAt) {
            setTimeout(() => {
                setShowPrompt(true);
            }, 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }

        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    // Don't show if already installed
    if (isStandalone) return null;

    return (
        <AnimatePresence>
            {showPrompt && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                        onClick={handleDismiss}
                    />

                    {/* Prompt Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
                    >
                        <div className="relative bg-gradient-to-br from-background via-card to-background border-2 border-border rounded-2xl shadow-2xl overflow-hidden">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl" />

                            {/* Close button */}
                            <button
                                onClick={handleDismiss}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors z-10"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>

                            <div className="relative p-6 pb-5">
                                {/* Icon */}
                                <div className="mb-4 flex justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                                        <Download className="w-8 h-8 text-primary-foreground" />
                                    </div>
                                </div>

                                {/* Title */}
                                <h2 className="text-xl font-serif font-bold text-center mb-2">
                                    Install Sisu
                                </h2>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                                    Add Sisu to your home screen for a seamless reading experience - faster access, offline reading, and no browser distractions.
                                </p>

                                {/* Benefits */}
                                <div className="space-y-3 mb-6">
                                    {[
                                        'Read offline anytime',
                                        'Quick access from home screen',
                                        'Immersive, distraction-free',
                                        'Automatic updates'
                                    ].map((benefit, i) => (
                                        <motion.div
                                            key={benefit}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex items-center gap-2"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            <span className="text-sm text-foreground">{benefit}</span>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* iOS Instructions */}
                                {isIOS ? (
                                    <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Share className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium mb-1">Install on iOS</p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Tap the Share button <Share className="w-3 h-3 inline mx-0.5" /> in Safari, then select "Add to Home Screen"
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Smartphone className="w-3.5 h-3.5" />
                                            <span>Works best in Safari browser</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* Android/Desktop Install Button */
                                    <Button
                                        onClick={handleInstallClick}
                                        disabled={!deferredPrompt}
                                        className="w-full rounded-xl h-12 text-base font-medium shadow-lg shadow-primary/20"
                                    >
                                        <Download className="w-5 h-5 mr-2" />
                                        Install App
                                    </Button>
                                )}

                                {/* Dismiss link */}
                                <button
                                    onClick={handleDismiss}
                                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}