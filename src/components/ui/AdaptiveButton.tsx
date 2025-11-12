'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useEmotionalUX } from '@/components/ux/EmotionalUXProvider';
import { motion } from 'framer-motion';

const adaptiveButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
      emotionalState: {
        calm: '',
        anxious: '',
        sad: '',
        angry: '',
        neutral: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      emotionalState: 'neutral',
    },
  }
);

export interface AdaptiveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof adaptiveButtonVariants> {
  asChild?: boolean;
  calming?: boolean;
  showFeedback?: boolean;
}

const AdaptiveButton = forwardRef<HTMLButtonElement, AdaptiveButtonProps>(
  ({ className, variant, size, emotionalState, calming, showFeedback, children, onClick, onDrag, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop, onAnimationStart, onAnimationEnd, onAnimationIteration, onTransitionEnd, ...props }, ref) => {
    const { currentAdaptation, isTransitioning } = useEmotionalUX();

    // Determine emotional state for styling
    const detectedEmotion = emotionalState || 'neutral';

    // Apply emotional adaptations
    const emotionalClasses = getEmotionalClasses(detectedEmotion, currentAdaptation, calming);

    // Animation variants based on emotional state
    const getAnimationVariants = () => {
      const baseVariants = {
        initial: { scale: 1, opacity: 1 },
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
      };

      switch (detectedEmotion) {
        case 'anxious':
          return {
            ...baseVariants,
            hover: { scale: 1.01 }, // Subtle hover for anxiety
            tap: { scale: 0.99 },
          };
        case 'calm':
          return {
            ...baseVariants,
            hover: { scale: 1.03, transition: { duration: 0.4 } },
          };
        case 'sad':
          return {
            ...baseVariants,
            hover: { scale: 1.015, transition: { duration: 0.3 } },
          };
        default:
          return baseVariants;
      }
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Add haptic feedback for emotional states
      if (showFeedback || currentAdaptation.interactions.feedback === 'extensive') {
        // Visual feedback
        const button = event.currentTarget;
        button.style.transform = 'scale(0.95)';

        setTimeout(() => {
          button.style.transform = '';
        }, 150);
      }

      onClick?.(event);
    };

    return (
      <motion.button
        className={cn(
          adaptiveButtonVariants({ variant, size, emotionalState: detectedEmotion }),
          emotionalClasses,
          isTransitioning && 'transition-all duration-300 ease-in-out',
          className
        )}
        ref={ref}
        variants={getAnimationVariants()}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        onClick={handleClick}
        style={{
          // Apply emotional spacing
          padding: getEmotionalSpacing(currentAdaptation),
          // Apply emotional typography
          fontSize: getEmotionalFontSize(currentAdaptation),
          fontWeight: getEmotionalFontWeight(currentAdaptation),
        }}
        {...props}
      >
        {children}

        {/* Emotional feedback indicator */}
        {showFeedback && currentAdaptation.interactions.feedback !== 'minimal' && (
          <motion.div
            className="absolute inset-0 rounded-md"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 0.1 }}
            style={{
              backgroundColor: currentAdaptation.colorScheme.accent,
            }}
          />
        )}
      </motion.button>
    );
  }
);

AdaptiveButton.displayName = 'AdaptiveButton';

// Helper functions for emotional adaptations
function getEmotionalClasses(
  emotion: string,
  adaptation: any,
  calming?: boolean
): string {
  const classes = [];

  // Apply calming colors if requested or if adaptation is calming
  if (calming || adaptation.colorScheme.calming) {
    classes.push('border-2');
    switch (emotion) {
      case 'anxious':
        classes.push('border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100');
        break;
      case 'sad':
        classes.push('border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100');
        break;
      case 'angry':
        classes.push('border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100');
        break;
      case 'calm':
        classes.push('border-green-200 bg-green-50 text-green-800 hover:bg-green-100');
        break;
      default:
        classes.push('border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100');
    }
  }

  // Apply spacing based on emotional state
  if (adaptation.spacing.density === 'spacious') {
    classes.push('px-6 py-3');
  } else if (adaptation.spacing.density === 'compact') {
    classes.push('px-2 py-1');
  }

  // Apply interaction complexity
  if (adaptation.interactions.complexity === 'simple') {
    classes.push('shadow-none border-2');
  }

  return classes.join(' ');
}

function getEmotionalSpacing(adaptation: any): string | undefined {
  if (adaptation.spacing.density === 'spacious') {
    return '12px 24px';
  } else if (adaptation.spacing.density === 'compact') {
    return '6px 12px';
  }
  return undefined;
}

function getEmotionalFontSize(adaptation: any): string | undefined {
  if (adaptation.typography.fontSize === 'large') {
    return '1.125rem';
  } else if (adaptation.typography.fontSize === 'small') {
    return '0.875rem';
  }
  return undefined;
}

function getEmotionalFontWeight(adaptation: any): string | undefined {
  switch (adaptation.typography.fontWeight) {
    case 'light':
      return '300';
    case 'bold':
      return '600';
    default:
      return '400';
  }
}

export { AdaptiveButton, adaptiveButtonVariants };