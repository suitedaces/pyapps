'use client'

import { motion } from 'framer-motion'

interface LoadingAnimationProps {
    message: string
}

export default function LoadingAnimation({ message }: LoadingAnimationProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
            <motion.div
                className="flex flex-col items-center gap-6"
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', duration: 0.6 }}
            >
                <style jsx>{`
                    .loader {
                        display: inline-grid;
                    }
                    .loader:before,
                    .loader:after {
                        content: '';
                        grid-area: 1/1;
                        height: 30px;
                        aspect-ratio: 6;
                        --c: #0000 64%, var(--loader-color) 66% 98%, #0000 101%;
                        background:
                            radial-gradient(35% 146% at 50% 159%, var(--c)) 0 0,
                            radial-gradient(35% 146% at 50% -59%, var(--c)) 25%
                                100%;
                        background-size: calc(100% / 3) 50%;
                        background-repeat: repeat-x;
                        -webkit-mask: repeating-linear-gradient(
                                90deg,
                                #000 0 15%,
                                #0000 0 50%
                            )
                            0 0/200%;
                        animation: loaderAnimation 0.8s infinite linear;
                    }
                    .loader:after {
                        transform: scale(-1);
                    }
                    @keyframes loaderAnimation {
                        to {
                            -webkit-mask-position: -100% 0;
                        }
                    }
                    :global(.dark) .loader:before,
                    :global(.dark) .loader:after {
                        --loader-color: #fff;
                    }
                    :global(.light) .loader:before,
                    :global(.light) .loader:after {
                        --loader-color: #000;
                    }
                `}</style>
                <div className="loader" />
                <motion.p
                    className="text-lg text-muted-foreground font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {message}
                </motion.p>
            </motion.div>
        </motion.div>
    )
}
