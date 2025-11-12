'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useEmotionalUX } from '@/components/ux/EmotionalUXProvider';

const calmCardVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm',
  {
    variants: {
      variant: {
        default: '',
        calming: 'border-2 shadow-lg',
        minimal: 'border-0 shadow-none bg-transparent',
        outlined: 'border-2 bg-transparent',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-12',
      },
      emotionalState: {
        calm: '',
        anxious: '',
        anxiety: '',
        sad: '',
        angry: '',
        neutral: '',
        joy: '',
        fear: '',
        frustration: '',
        hope: '',
        overwhelm: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
      emotionalState: 'neutral',
    },
  }
);

export interface CalmCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calmCardVariants> {
  calming?: boolean;
  progressive?: boolean;
  showControls?: boolean;
}

const CalmCard = forwardRef<HTMLDivElement, CalmCardProps>(
  ({
    className,
    variant,
    padding,
    emotionalState,
    calming,
    progressive,
    showControls,
    children,
    ...props
  }, ref) => {
    const { currentAdaptation, currentEmotion } = useEmotionalUX();

    // Determine emotional state and map to supported variants
    const rawEmotion = emotionalState || currentEmotion?.primaryEmotion || 'neutral';
    const detectedEmotion = mapEmotionToVariant(rawEmotion);

    // Apply emotional adaptations
    const emotionalClasses = getEmotionalCardClasses(detectedEmotion, currentAdaptation, calming);

    // Progressive disclosure state
    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set());

    const toggleSection = (sectionId: string) => {
      const newExpanded = new Set(expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      setExpandedSections(newExpanded);
    };

    // Split content into sections for progressive disclosure
    const contentSections = React.useMemo(() => {
      if (!progressive) {
        return [{ id: 'main', content: children, alwaysVisible: true }];
      }

      // For progressive disclosure, create expandable sections
      return [
        { id: 'primary', content: children, alwaysVisible: true },
        { id: 'secondary', content: null, alwaysVisible: false },
        { id: 'tertiary', content: null, alwaysVisible: false }
      ];
    }, [children, progressive]);

    return (
      <div
        ref={ref}
        className={cn(
          calmCardVariants({ variant, padding, emotionalState: detectedEmotion }),
          emotionalClasses,
          'transition-all duration-300 ease-in-out',
          className
        )}
        style={{
          backgroundColor: getEmotionalBackground(detectedEmotion, currentAdaptation),
          borderColor: getEmotionalBorder(detectedEmotion, currentAdaptation),
          boxShadow: getEmotionalShadow(detectedEmotion, currentAdaptation),
        }}
        {...props}
      >
        {progressive ? (
          <div className="space-y-4">
            {contentSections.map((section) => (
              <div key={section.id}>
                {section.alwaysVisible || shouldShowSection(section.id, detectedEmotion, currentAdaptation) ? (
                  <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                    {section.content}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-md border-2 border-dashed',
                      'hover:bg-accent/50 transition-colors duration-200',
                      'text-sm text-muted-foreground',
                      getEmotionalButtonStyle(detectedEmotion, currentAdaptation)
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span>Show more content</span>
                      <span className="text-xs">
                        {expandedSections.has(section.id) ? '−' : '+'}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          children
        )}

        {/* Emotional state indicator */}
        {showControls && currentEmotion && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Emotional state: {currentEmotion.primaryEmotion}</span>
              <div className="flex items-center space-x-2">
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${currentEmotion.intensity * 100}%`,
                      backgroundColor: getEmotionalIndicatorColor(currentEmotion.primaryEmotion)
                    }}
                  />
                </div>
                <span>{Math.round(currentEmotion.intensity * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CalmCard.displayName = 'CalmCard';

// Helper functions for emotional adaptations
function getEmotionalCardClasses(
  emotion: string,
  adaptation: any,
  calming?: boolean
): string {
  const classes = [];

  // Apply calming styles
  if (calming || adaptation.colorScheme.calming) {
    classes.push('backdrop-blur-sm');
  }

  // Apply spacing adaptations
  switch (adaptation.spacing.density) {
    case 'spacious':
      classes.push('space-y-6');
      break;
    case 'compact':
      classes.push('space-y-2');
      break;
  }

  // Apply emotional state specific styles
  switch (emotion) {
    case 'anxious':
      classes.push('shadow-blue-100 border-blue-200');
      break;
    case 'sad':
      classes.push('shadow-indigo-100 border-indigo-200');
      break;
    case 'angry':
      classes.push('shadow-amber-100 border-amber-200');
      break;
    case 'calm':
      classes.push('shadow-green-100 border-green-200');
      break;
  }

  return classes.join(' ');
}

function getEmotionalBackground(emotion: string, adaptation: any): string | undefined {
  if (!adaptation.colorScheme.calming) {
    return undefined;
  }

  switch (emotion) {
    case 'anxious':
      return 'rgba(239, 246, 255, 0.8)';
    case 'sad':
      return 'rgba(238, 242, 255, 0.8)';
    case 'angry':
      return 'rgba(255, 251, 235, 0.8)';
    case 'calm':
      return 'rgba(236, 253, 245, 0.8)';
    default:
      return 'rgba(249, 250, 251, 0.8)';
  }
}

function getEmotionalBorder(emotion: string, adaptation: any): string | undefined {
  if (!adaptation.colorScheme.calming) {
    return undefined;
  }

  switch (emotion) {
    case 'anxious':
      return '#bfdbfe';
    case 'sad':
      return '#c7d2fe';
    case 'angry':
      return '#fde68a';
    case 'calm':
      return '#bbf7d0';
    default:
      return '#e5e7eb';
  }
}

function getEmotionalShadow(emotion: string, adaptation: any): string | undefined {
  if (adaptation.animations.intensity === 'subtle') {
    return '0 1px 3px rgba(0, 0, 0, 0.1)';
  }

  switch (emotion) {
    case 'anxious':
      return '0 4px 6px rgba(59, 130, 246, 0.1)';
    case 'sad':
      return '0 4px 6px rgba(99, 102, 241, 0.1)';
    case 'angry':
      return '0 4px 6px rgba(245, 158, 11, 0.1)';
    case 'calm':
      return '0 4px 6px rgba(34, 197, 94, 0.1)';
    default:
      return '0 1px 3px rgba(0, 0, 0, 0.1)';
  }
}

function shouldShowSection(
  sectionId: string,
  emotion: string,
  adaptation: any
): boolean {
  // Show more content for calmer emotional states
  if (emotion === 'calm' || emotion === 'joy') {
    return true;
  }

  // Show less for high-intensity negative emotions
  if ((emotion === 'anxiety' || emotion === 'fear') && adaptation.content.length === 'brief') {
    return sectionId === 'primary';
  }

  // Default behavior
  return sectionId === 'primary' || sectionId === 'secondary';
}

function getEmotionalButtonStyle(emotion: string, adaptation: any): string {
  if (!adaptation.colorScheme.calming) {
    return '';
  }

  switch (emotion) {
    case 'anxious':
      return 'border-blue-300 text-blue-700 hover:bg-blue-50';
    case 'sad':
      return 'border-indigo-300 text-indigo-700 hover:bg-indigo-50';
    case 'angry':
      return 'border-amber-300 text-amber-700 hover:bg-amber-50';
    case 'calm':
      return 'border-green-300 text-green-700 hover:bg-green-50';
    default:
      return 'border-gray-300 text-gray-700 hover:bg-gray-50';
  }
}

function getEmotionalIndicatorColor(emotion: string): string {
  switch (emotion) {
    case 'anxious':
    case 'fear':
      return '#3b82f6';
    case 'sadness':
      return '#6366f1';
    case 'anger':
    case 'frustration':
      return '#f59e0b';
    case 'calm':
    case 'joy':
    case 'hope':
      return '#10b981';
    case 'overwhelm':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

// Helper function to map emotion types to supported variants
function mapEmotionToVariant(emotion: string): "calm" | "anxious" | "anxiety" | "sad" | "angry" | "neutral" | "joy" | "fear" | "frustration" | "hope" | "overwhelm" {
  const emotionMap: Record<string, "calm" | "anxious" | "anxiety" | "sad" | "angry" | "neutral" | "joy" | "fear" | "frustration" | "hope" | "overwhelm"> = {
    calm: 'calm',
    anxious: 'anxious',
    anxiety: 'anxiety',
    sad: 'sad',
    sadness: 'sad',
    angry: 'angry',
    neutral: 'neutral',
    joy: 'joy',
    fear: 'fear',
    frustration: 'frustration',
    hope: 'hope',
    overwhelm: 'overwhelm'
  };

  return emotionMap[emotion] || 'neutral';
}

export { CalmCard, calmCardVariants };